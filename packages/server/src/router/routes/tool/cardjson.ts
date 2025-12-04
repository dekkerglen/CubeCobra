import cardutil from '@utils/cardutil';
import { PrintingPreference } from '@utils/datatypes/Card';
import { Period } from '@utils/datatypes/History';
import CardHistory from 'dynamo/models/cardhistory';
import {
  cardFromId,
  getEnglishVersion,
  getIdsFromName,
  getMostReasonable,
  getMostReasonableById,
  getRelatedCards,
} from 'serverutils/carddb';
import carddb from 'serverutils/carddb';
import { redirect } from 'serverutils/render';
import { csrfProtection } from 'src/router/middleware';
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

export const getCardJsonHandler = async (req: Request, res: Response) => {
  try {
    const id = chooseIdFromInput(req);

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    // otherwise just go to this ID.
    const history = await CardHistory.getByOracleAndType(card.oracle_id, Period.WEEK, 52);

    if (history.items && history.items.length === 0) {
      history.items.push({} as any);
    }

    const printingPreference = (req?.user?.defaultPrinting || PrintingPreference.RECENT) as PrintingPreference;
    const related = getRelatedCards(card.oracle_id, printingPreference);

    const oracleVersions = carddb.oracleToId[card.oracle_id];
    const versions = oracleVersions
      ? oracleVersions.filter((cid) => cid !== card.scryfall_id).map((cardid) => cardFromId(cardid))
      : [];

    return res.json({
      card,
      history: history.items ? history.items.reverse() : [],
      lastKey: history.lastKey,
      versions,
      draftedWith: related.draftedWith,
      cubedWith: related.cubedWith,
      synergistic: related.synergistic,
    });
  } catch (err) {
    const error = err as Error;
    return res.json({ error: error.message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, getCardJsonHandler],
  },
];
