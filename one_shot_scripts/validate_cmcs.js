const mongoose = require('mongoose');

const mongosecrets = require('../../cubecobrasecrets/mongodb');

const Cube = require('../models/cube');

(async () => {
  mongoose.connect(mongosecrets.connectionString).then(async () => {
    const totalCubes = await Cube.count();
    for (let start = 0; start < totalCubes; start += 100) {
      // eslint-disable-next-line no-await-in-loop
      const cubes = await Cube.find()
        .skip(start)
        .limit(100);
      const collected = [];
      for (const cube of cubes) {
        for (const card of cube.cards) {
          card.cmc = card.cmc || 0;
        }
        collected.push(cube);
      }
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(collected.map((cube) => cube.save()));
      console.log(`Completed ${start + collected.length} cubes`);
    }
    mongoose.disconnect();
  });
})();
