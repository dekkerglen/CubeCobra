/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');

const BATCH_SIZE = 1024;

const needsCleaning = (cube) => cube.draft_formats.length > 0;

const processCube = async (leanCube) => {
  if (needsCleaning(leanCube)) {
    const cube = await Cube.findById(leanCube._id);

    console.debug(`Cleaning cube ${cube.name}: ${cube._id}`);

    for (const format of cube.draft_formats) {
      // format.packs = format.packs.map((pack) => ({ slots: pack }));

      // console.log(format.packs);

      for (const pack of format.packs) {
        console.log(pack);
      }
    }

    // await cube.save();
  }
};

try {
  (async () => {
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();

    // batch them by batchSize
    for (let i = 0; i < count; ) {
      const cubes = [];
      const nextBound = Math.min(i + BATCH_SIZE, count);
      for (; i < nextBound; i++) {
        const cube = await cursor.next();
        if (cube) {
          cubes.push(processCube(cube));
        }
      }

      await Promise.all(cubes);

      console.log(`Finished: ${i} of ${count} cubes`);
    }

    mongoose.disconnect();
    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
