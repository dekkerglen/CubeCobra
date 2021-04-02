// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');

const batchSize = 100;

async function addVars(cube) {
  cube.basics = [
    '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
    '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
    '19e71532-3f79-4fec-974f-b0e85c7fe701',
    '8365ab45-6d78-47ad-a6ed-282069b0fabc',
    '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
  ];

  return cube.save();
}

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async (db) => {
    const count = await Cube.countDocuments();
    const cursor = Cube.find().cursor();

    // batch them in 100
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
        } catch (err) {}
      }
      await Promise.all(cubes.map((cube) => addVars(cube)));
      console.log(`Finished: ${i} of ${count} cubes`);
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
