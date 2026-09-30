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

    // `?size=small` opts into Scryfall's 146px image. The default 488px one is
    // right for anything card-sized, but the daily-game boards render tiles at
    // ~100 CSS px, and asking the browser for a 2.4x downscale is what made
    // those look aliased — past roughly 2x, Chrome stops filtering well. A
    // source near the displayed size is the fix; opt-in so every other caller
    // keeps the full-quality image.
    const wantsSmall = req.query?.size === 'small';
    const image = wantsSmall ? (card.image_small ?? card.image_normal) : card.image_normal;

    if (card.error || !image) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 month
      return redirect(req, res, '/content/invalidcard.png');
    }

    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 month
    return redirect(req, res, image);
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 year
    return redirect(req, res, '/content/invalidcard.png');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [getCardImageHandler],
  },
];
