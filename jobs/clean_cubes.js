/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');
const carddb = require('../serverjs/cards.js');

const batchSize = 1000;

const isInvalidCardId = (id) => carddb.cardFromId(id).name === 'Invalid Card';

const needsCleaning = (cube) => {
  if (!cube.cards) {
    return true;
  }

  if (cube.cards.some((card) => !card || isInvalidCardId(card.cardID))) {
    return true;
  }

  return false;
};

const processCube = async (leanCube) => {
  if (needsCleaning(leanCube)) {
    const cube = await Cube.findById(leanCube._id);

    console.log(`Cleaning cube ${cube.name}: ${cube._id}`);

    if (!cube.cards) {
      cube.cards = [];
    }
    cube.cards = cube.cards.filter((c) => c && !isInvalidCardId(c.cardID));

    await cube.save();
  }
};

try {
  (async () => {
    await carddb.initializeCardDb();
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();

    // batch them by batchSize
    for (let i = 0; i < count; i += batchSize) {
      const cubes = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const cube = await cursor.next();
          if (cube) {
            cubes.push(cube);
          }
        }
      }

      await Promise.all(cubes.map(processCube));

      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} cubes`);
    }

    mongoose.disconnect();
    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
