const mongoose = require('mongoose');
const Cube = require('../models/cube');
(async () => {
  mongoose.connect(config.database).then( async (db) => {
    const totalCubes = await Cube.count();
    for (let start = 0; start < totalCubes; start += 100) {
      const cubes = await Cube.find().skip(start).limit(100);
      const collected = [];
      for (const cube of cubes) {
        for (const card of cube.cards) {
          card.colors = card.colors.filter(c => [...'WUBRG'].includes(c));
        }
        collected.push(cube);
      }
      await Promise.all(collected.map(cube => cube.save()));
      console.log(`Completed ${start + collected.length} cubes`);
    }
    mongoose.disconnect();
  });
})();
