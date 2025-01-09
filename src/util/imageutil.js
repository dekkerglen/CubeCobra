//Split this into its own file to prevent cyclic dependencies

const cardutil = require('../client/utils/Card');
const carddb = require('./carddb');

// uri
// artist
// id
function getImageData(imagename) {
  const exact = carddb.imagedict[imagename.toLowerCase()];

  if (exact) {
    return exact;
  }

  const name = cardutil.normalizeName(imagename);
  const ids = carddb.nameToId[name];
  if (ids) {
    const byName = carddb.cardFromId(ids[0]);
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
