// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const { winston } = require('./serverjs/cloudwatch');
const updatedb = require('./serverjs/updatecards.js');
const CardRating = require('./models/cardrating');
const CardHistory = require('./models/cardhistory');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    let ratings = [];
    if (process.env.USE_S3 !== 'true') {
      ratings = await CardRating.find({}, 'name elo embedding').lean();
      histories = await CardHistory.find({}, 'oracleId current.total').lean();
    }
    await updatedb.updateCardbase(ratings, histories);
  } catch (error) {
    winston.error(error, { error });
  }

  process.exit();
})();
