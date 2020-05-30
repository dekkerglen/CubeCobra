require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube.js');

const batchSize = 100;

const mapCard = (card) => {
  if (!card.picks) {
    card.picks = [];
  }
  if (!card.passed) {
    card.passed = 0;
  }
  return card;
};

const migratecube = async (cube) => {
  cube.cards = cube.cards.map(mapCard);
  return cube;
};

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();
    for (let i = 0; i < count; i += batchSize) {
      const cubes = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          // eslint-disable-next-line no-await-in-loop
          const cube = await cursor.next();
          if (cube) {
            cubes.push(migratecube(cube));
          }
        }
      }
      // eslint-disable-next-line no-await-in-loop
      const operations = (await Promise.all(cubes))
        .filter((cube) => cube)
        .map((cube) => ({
          replaceOne: {
            filter: { _id: cube._id },
            replacement: cube,
          },
        }));
      if (operations.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await Cube.bulkWrite(operations);
      }
      console.log(`Finished: ${i + batchSize} of ${count} cubes`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
