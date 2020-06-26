// Load Environment Variables
require('dotenv').config();

const winston = require('winston');
const mongoose = require('mongoose');
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
    const ratings = await CardRating.find({}, 'name elo').lean();
    await updatedb.updateCardbase(ratings);
    process.exit();
  });
})();
