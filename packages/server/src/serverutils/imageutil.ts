//Split this into its own file to prevent cyclic dependencies

import * as cardutil from '@utils/cardutil';
import Image from '@utils/datatypes/Image';

import carddb, { cardFromId, getIdsFromName } from './carddb';

// uri
// artist
// id

const FALLBACK_IMAGE: Image = {
  uri: '',
  artist: 'Unknown',
  id: 'default',
  imageName: 'default',
};

export function getImageData(imagename: string | undefined): Image {
  const defaultImage = carddb.imagedict['doubling cube [10e-321]'] ?? FALLBACK_IMAGE;

  if (!imagename) {
    return defaultImage;
  }

  const exact = carddb.imagedict[imagename.toLowerCase()];

  if (exact) {
    return exact;
  }

  const name = cardutil.normalizeName(imagename);
  const ids = getIdsFromName(name);

  if (ids !== undefined && ids.length > 0 && ids[0]) {
    const byName = cardFromId(ids[0]);
    if (byName?.scryfall_id && byName.art_crop && byName.artist) {
      return {
        uri: byName.art_crop,
        artist: byName.artist,
        id: byName.scryfall_id,
        imageName: imagename,
      };
    }
  }

  return defaultImage;
}
