const mongoose = require('mongoose');
const Cube = require('../models/cube');
const config = require('../config/database');

(async () => {
  mongoose.connect(config.database).then( async (db) => {
    const cubes = await Cube.find();
    let i = 0;
    for (const cube of cubes) {
      for (const card of cube.cards) {
        card.colors = card.colors.filter(c => [...'WUBRG'].includes(c));
      }
      await Cube.updateOne({_id: cube._id }, cube);
      i++;
      if (i % 100 == 0) {
        console.log(i);
      }
    }
    mongoose.disconnect();
  });
})();
