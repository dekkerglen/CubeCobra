// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const { setCubeType } = require('../serverjs/cubefn.js');
const carddb = require('../serverjs/cards');

const Cube = require('../models/cube');

const batchSize = 100;

async function addVars(cube) {
  try {
    cube = setCubeType(cube, carddb);

    return cube.save();
  } catch (err) {
    console.error(err);
  }
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb('private', true);

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
      } catch (err) {}
    }
    await Promise.all(cubes.map((cube) => addVars(cube)));
    console.log(`Finished: ${i} of ${count} cubes`);
  }
  mongoose.disconnect();
  console.log('done');
  process.exit();
})();
