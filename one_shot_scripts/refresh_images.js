// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');
const carddb = require('../serverjs/cards');

const batchSize = 100;

async function fixImage(cube) {
  // only urls from the img.* subdomain are invalid
  if (!cube.image_uri.startsWith('https://img.scryfall.com')) return;

  const image = carddb.imagedict[cube.image_name.toLowerCase().trim()];
  if (!image) return;

  cube.image_uri = image.uri;
  await cube.save();
}

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const count = await Cube.countDocuments();
    const cursor = Cube.find().cursor();

    // batch them by batchSize
    for (let i = 0; i < count; i += batchSize) {
      const cubes = [];
      for (let j = 0; j < batchSize; j++) {
        try {
          if (i + j < count) {
            const cube = await cursor.next();
            if (cube) {
              cubes.push(cube);
            }
          }
        } catch (err) {
          console.debug(err);
        }
      }
      await Promise.all(cubes.map((cube) => fixImage(cube)));
      console.log(`Finished: ${i} of ${count} cubes`);
    }
    await mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
