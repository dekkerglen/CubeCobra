import { PrintingPreference } from '@utils/datatypes/Card';
import cardutil from '@utils/cardutil';
import { validate as uuidValidate } from 'uuid';
import { csrfProtection } from 'src/router/middleware';
import {
  cardFromId,
  getEnglishVersion,
  getIdsFromName,
  getMostReasonable,
  getMostReasonableById,
} from 'serverutils/carddb';
import carddb from 'serverutils/carddb';
import { handleRouteError, redirect } from 'serverutils/render';

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

export const getCardImageFlipHandler = async (req: Request, res: Response) => {
  try {
    const id = chooseIdFromInput(req);

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error || !card.image_flip) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    return redirect(req, res, card.image_flip);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, getCardImageFlipHandler],
  },
];
