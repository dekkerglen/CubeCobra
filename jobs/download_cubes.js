/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 download_cubes.js
// will oom without the added tag
// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');

require('../models/mongoinit');
const Cube = require('../models/cube');
const carddb = require('../serverjs/cards');
const { getObjectCreatedAt, loadCardToInt, writeFile } = require('./utils');

// Number of documents to process at a time
const batchSize = 1024;
// Minimum size in bytes of the output files (last file may be smaller).
const minFileSize = 128 * 1024 * 1024; // 128 MB

const isValidCube = (cube) => cube && cube.cards && cube.cards.length > 0 && cube.isListed !== false;

const processCube = (cube, cardToInt) => ({
  name: cube.name,
  id: cube._id,
  ownerName: cube.owner_name,
  shortId: cube.shortID,
  categoryOverride: cube.categoryOverride,
  categoryPrefixes: cube.categoryPrefixes,
  tags: cube.tags,
  dateUpdated: cube.date_updated,
  cards: cube.cards
    .filter((c) => c)
    .map((card) => cardToInt[carddb.cardFromId(card.cardID).name_lower])
    .filter((c) => c || c === 0),
  maybe: (cube.maybe || [])
    .filter((c) => c)
    .map((card) => cardToInt[carddb.cardFromId(card.cardID).name_lower])
    .filter((c) => c || c === 0),
  basics: (cube.basics || [])
    .filter((c) => c)
    .map((card) => cardToInt[carddb.cardFromId(card).name_lower])
    .filter((c) => c || c === 0),
  numUsersFollowing: (cube.users_following || []).length,
  imageUri: cube.image_uri,
  imageName: cube.image_name,
  imageArtist: cube.image_artist,
  numDecks: cube.numDecks,
  type: cube.type,
  createdAt: getObjectCreatedAt(cube._id),
});
try {
  (async () => {
    const { cardToInt } = await loadCardToInt();
    await mongoose.connect(process.env.MONGODB_URL);
    // process all cube objects
    const count = await Cube.countDocuments({ isListed: true });
    const cursor = Cube.find({ isListed: true }).lean().cursor();

    let counter = 0;
    let i = 0;
    while (i < count) {
      const cubes = [];
      let size = 0;
      for (; size < minFileSize && i < count; ) {
        const processingCubes = [];
        const nextBound = Math.min(i + batchSize, count);
        for (; i < nextBound; i++) {
          // eslint-disable-next-line no-await-in-loop
          const cube = await cursor.next();
          if (isValidCube(cube)) {
            processingCubes.push(processCube(cube, cardToInt));
          }
        }
        size += Buffer.byteLength(JSON.stringify(processingCubes));
        cubes.push(...processingCubes);
        console.log(
          `Finished: ${i} of ${count} cubes and the buffer is approximately ${(size / 1024 / 1024).toFixed(2)} MB.`,
        );
      }
      if (cubes.length > 0) {
        const filename = `cubes/${counter.toString().padStart(6, '0')}.json`;
        writeFile(filename, cubes);
        counter += 1;
        console.log(`Wrote file ${filename} with ${cubes.length} cubes.`);
      }
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
