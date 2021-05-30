// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const CardRating = require('../models/cardrating');

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const res = await CardRating.deleteMany({ name: null });

    console.log(res);

    console.log('done');
    process.exit();
  });
})();
