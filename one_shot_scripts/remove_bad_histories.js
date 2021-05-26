// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const CardHistory = require('../models/cardHistory');

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const res = await CardHistory.deleteMany({ history: { $size: 1 } }).lean();

    console.log(res);

    console.log('done');
    process.exit();
  });
})();
