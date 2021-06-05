// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const CubeAnalytic = require('../models/cubeAnalytic');

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const analytic = await CubeAnalytic.findOne({ cube: '5d61aa23b8ec593ca4b76ca6' });

    console.log(analytic.cards.filter((card) => !card.cardName));

    console.log('done');
    process.exit();
  });
})();
