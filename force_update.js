// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const { winston } = require('./serverjs/cloudwatch');
const updatedb = require('./serverjs/updatecards.js');
const CardRating = require('./models/cardrating');

winston.configure({
  level: 'info',
  format: winston.format.simple(),
  exitOnError: false,
  transports: [new winston.transports.Console()],
});

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    let ratings = [];
    if (!process.env.USE_S3 === 'true') {
      ratings = await CardRating.find({}, 'name elo embedding').lean();
    }
    await updatedb.updateCardbase(ratings);
    process.exit();
  });
})();
