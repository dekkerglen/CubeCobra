/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');

const batchSize = 100;

const processCube = async (cube) => {
  cube.shortID = cube.urlAlias;
  cube.urlAlias = undefined;

  await cube.save();
};

try {
  (async () => {
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments({ urlAlias: { $exists: true, $ne: null } });
    const cursor = Cube.find({ urlAlias: { $exists: true, $ne: null } }, 'shortID urlAlias').cursor();

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
