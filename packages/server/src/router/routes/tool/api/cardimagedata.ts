import { normalizeName } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Image from '@utils/datatypes/Image';
import carddb, { cardFromId, getIdsFromName } from 'serverutils/carddb';
import { canonicalPrintingForName } from 'serverutils/cardPrintings';

import { Request, Response } from '../../../../types/express';

const imageFromDetails = (card: CardDetails, imageName: string): Image | null => {
  if (!card.scryfall_id || !card.art_crop || !card.artist) {
    return null;
  }
  return { uri: card.art_crop, artist: card.artist, id: card.scryfall_id, imageName };
};

// Single-card image lookup. Replaces the old imagedict.json (~28MB) that the
// browser downloaded whole just to resolve one card name → art. Mirrors the
// imagedict lookup in imageutil.getImageData but, unlike that helper, returns
// image: null when there is no real match (callers gate UI on a hit, so a
// silent default-card fallback would be wrong here).
//
// `firstPrinting` is for callers that want the card rather than a printing of it.
// A bare card name resolves through nameToId, whose ids are in catalog order, so
// the art it lands on is arbitrary — "some iconic card, as a goofy Secret Lair".
// Under the flag the name resolves to the card's canonical printing instead, which
// also sees through reskins ("Party Tree" gets The Great Henge's original art).
// It is opt-in because the printing-picker callers (article and video thumbnails,
// cube and profile art) are choosing one specific printing on purpose, and pass a
// full name with a set code to say so.
const lookupImage = (rawName: string, firstPrinting: boolean): Image | null => {
  if (firstPrinting) {
    const canonical = canonicalPrintingForName(rawName);
    // Misses fall through: a full name like "the great henge [eld-161]" names a
    // printing explicitly, and an explicit printing outranks the default.
    if (canonical) {
      const image = imageFromDetails(canonical, canonical.full_name);
      if (image) {
        return image;
      }
    }
  }

  const exact = carddb.imagedict[rawName.toLowerCase()];
  if (exact) {
    return exact;
  }

  const ids = getIdsFromName(normalizeName(rawName));
  if (ids && ids.length > 0 && ids[0]) {
    const card = cardFromId(ids[0]);
    if (card) {
      const image = imageFromDetails(card, rawName);
      if (image) {
        return image;
      }
    }
  }

  return null;
};

export const cardImageDataHandler = async (req: Request, res: Response) => {
  try {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    if (!name) {
      return res.status(400).send({ success: 'false', message: 'name is required' });
    }
    const firstPrinting = req.query.firstPrinting === '1' || req.query.firstPrinting === 'true';

    return res.status(200).send({ success: 'true', image: lookupImage(name, firstPrinting) });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card image',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [cardImageDataHandler],
  },
];
