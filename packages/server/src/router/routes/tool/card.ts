import cardutil from '@utils/cardutil';
import { PrintingPreference } from '@utils/datatypes/Card';
import { Period } from '@utils/datatypes/History';
import { cardHistoryDao } from 'dynamo/daos';
import carddb, {
  cardFromId,
  getEnglishVersion,
  getIdsFromName,
  getMostReasonable,
  getMostReasonableById,
  getOracleForMl,
  getRelatedCards,
} from 'serverutils/carddb';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';
import { validate as uuidValidate } from 'uuid';

import { Request, Response } from '../../../types/express';

const chooseIdFromInput = (req: Request): string => {
  //ID is scryfall id or a card name (eg. via Autocomplete hover)
  const printingPreference = (req?.query?.defaultPrinting || req?.user?.defaultPrinting) as
    | PrintingPreference
    | undefined;
  let { id } = req.params;

  if (!id) {
    return '';
  }

  if (!uuidValidate(id)) {
    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = getIdsFromName(possibleName);
    if (ids !== undefined && ids.length > 0) {
      const card = getMostReasonable(possibleName, printingPreference);
      if (card) {
        id = card.scryfall_id;
      }
    }
  }

  // if id is a foreign id, redirect to english version
  const english = getEnglishVersion(id);
  if (english) {
    id = english;
  }

  // if id is an oracle id, redirect to most reasonable scryfall
  const oracleIds = carddb.oracleToId[id];
  if (oracleIds && oracleIds[0]) {
    const card = getMostReasonableById(oracleIds[0], printingPreference);
    if (card) {
      id = card.scryfall_id;
    }
  }

  return id;
};

export const getCardHandler = async (req: Request, res: Response) => {
  try {
    const id = chooseIdFromInput(req);

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    // otherwise just go to this ID.
    const history = await cardHistoryDao.queryByOracleAndType(card.oracle_id, Period.WEEK, 52);

    if (history.items && history.items.length === 0) {
      history.items.push({} as any);
    }

    const printingPreference = (req?.user?.defaultPrinting || PrintingPreference.RECENT) as PrintingPreference;
    const related = getRelatedCards(card.oracle_id, printingPreference);
    const mlSubstitution = getOracleForMl(card.oracle_id, printingPreference || null);

    const baseUrl = getBaseUrl();
    const oracleVersions = carddb.oracleToId[card.oracle_id];
    const versions = oracleVersions
      ? oracleVersions
          .filter((cid) => cid !== card.scryfall_id)
          .map((cardid) => cardFromId(cardid))
          .filter((c) => !c.isExtra) //Card isExtra if its the preflipped backside
      : [];

    return render(
      req,
      res,
      'CardPage',
      {
        card,
        mlSubstitution: mlSubstitution ? cardFromId(mlSubstitution) : null,
        history: history.items ? history.items.reverse() : [],
        lastKey: history.lastKey,
        versions,
        draftedWith: related.draftedWith,
        cubedWith: related.cubedWith,
        synergistic: related.synergistic,
      },
      {
        title: `${card.name}`,
        metadata: generateMeta(
          `${card.name} - Cube Cobra`,
          `Analytics for ${card.name} on CubeCobra`,
          card.image_normal || '',
          `${baseUrl}/tool/card/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    console.error(err);
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [getCardHandler],
  },
];
