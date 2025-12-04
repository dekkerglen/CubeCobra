import cardutil from '@utils/cardutil';
import { PrintingPreference } from '@utils/datatypes/Card';
import {
  cardFromId,
  getEnglishVersion,
  getIdsFromName,
  getMostReasonable,
  getMostReasonableById,
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

export const getCardImageHandler = async (req: Request, res: Response) => {
  try {
    const id = chooseIdFromInput(req);

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error || !card.image_normal) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 month
      return redirect(req, res, '/content/default_card.png');
    }

    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 month
    return redirect(req, res, card.image_normal);
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 year
    return redirect(req, res, '/content/default_card.png');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, getCardImageHandler],
  },
];
