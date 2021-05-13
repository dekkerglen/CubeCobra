// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');

const Cube = require('../models/cube');
const carddb = require('../serverjs/cards');
const { getObjectCreatedAt, loadCardToInt, writeFile } = require('./utils');

// Number of documents to process at a time
const batchSize = 1000;
// Minimum size in bytes of the output files (last file may be smaller).
const minFileSize = 128 * 1024 * 1024; // 128 MB

const processCube = (cube, cardToInt) => ({
  name: cube.name,
  id: cube._id,
  ownerName: cube.owner_name,
  shortId: cube.shortID,
  urlAlias: cube.urlAlias,
  categoryOverride: cube.categoryOverride,
  categoryPrefixes: cube.categoryPrefixes,
  tags: cube.tags,
  dateUpdated: cube.date_updated,
  cards: cube.cards.map((card) => cardToInt[carddb.cardFromId(card.cardID).name_lower]),
  maybe: cube.maybe.map((card) => cardToInt[carddb.cardFromId(card.cardID).name_lower]),
  basics: cube.basics.map((card) => cardToInt[carddb.cardFromId(card).name_lower]),
  numUsersFollowing: cube.users_following.length,
  imageUri: cube.image_uri,
  imageName: cube.image_name,
  imageArtist: cube.image_artist,
  numDecks: cube.numDecks,
  type: cube.type,
  createdAt: getObjectCreatedAt(cube._id),
});

(async () => {
  const { cardToInt } = await loadCardToInt();
  await mongoose.connect(process.env.MONGODB_URL);
  // process all cube objects
  console.log('Started');
  const count = await Cube.countDocuments();
  const cursor = Cube.find().lean().cursor();

  let counter = 0;
  let i = 0;
  const cubes = [];
  while (i < count) {
    for (; Buffer.byteLength(JSON.stringify(cubes)) < minFileSize && i < count; i += batchSize) {
      for (let j = 0; j < Math.min(batchSize, count - i); j++) {
        // eslint-disable-next-line no-await-in-loop
        const cube = await cursor.next();
        console.log(Object.keys(cube));
        if (cube.isListed) {
          cubes.push(processCube(cube, cardToInt));
        }
      }
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} cubes`);
    }
    if (cubes.length > 0) {
      const filename = `cubes/${counter.toString().padStart(6, '0')}.json`;
      writeFile(filename, cubes);
      counter += 1;
      console.log(`Wrote file ${filename} with ${cubes.length} cubes.`);
      cubes.length = 0;
    }
  }
  mongoose.disconnect();
  console.log('done');
  process.exit();
})();
