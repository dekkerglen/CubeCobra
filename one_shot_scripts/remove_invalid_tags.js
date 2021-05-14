// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();
const fs = require('fs');

const path = (batch) => `jobs/export/cubes/${batch}.json`;

const mongoose = require('mongoose');

const Cube = require('../models/cube');
const carddb = require('../serverjs/cards.js');

const batchSize = 100;

const processCube = (cube) => {
  for (const card of cube.cards) {
    card.tags = card.tags.filter((tag) => tag && tag.length > 0);
    card.colors = card.colors.filter((color) => color);
  }

  return Cube.updateOne({ _id: cube._id }, cube);
};

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
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
            cubes.push(processCube(cube));
          }
        }
      }

      await Promise.all(cubes);
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} cubes`);
    }
    mongoose.disconnect();
    console.log('done');
  });
})();
