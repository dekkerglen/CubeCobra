//Split this into its own file to prevent cyclic dependencies

const cardutil = require('../client/utils/cardutil');
import carddb, { cardFromId, getIdsFromName } from './carddb';

// uri
// artist
// id
export function getImageData(imagename) {
  const exact = carddb.imagedict[imagename.toLowerCase()];

  if (exact) {
    return exact;
  }

  const name = cardutil.normalizeName(imagename);
  const ids = getIdsFromName(name);

  if (ids !== undefined && ids.length > 0) {
    const byName = cardFromId(ids[0]);
    if (byName.scryfall_id) {
      return {
        uri: byName.art_crop,
        artist: byName.artist,
        id: byName.scryfall_id,
        imageName: imagename,
      };
    }
  }

  return carddb.imagedict['doubling cube [10e-321]'];
}

module.exports = {
  getImageData,
};
