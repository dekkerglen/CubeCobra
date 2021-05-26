// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const carddb = require('../serverjs/cards.js');
const CardRating = require('../models/cardrating');
const fetch = require('node-fetch');

const BATCH_SIZE = 100;

const processCard = async (card) => {
  const rating = await CardRating.findOne({name:card.name});

  if(!rating) {
    const newRating = new CardRating();
    newRating.name = card.name;
    newRating.elo = 1200;
    newRating.picks = 0;
    await newRating.save();
  }
}

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {

    let processed = 0;
    const allOracleIds = carddb.allOracleIds();
    for (const oracleId of allOracleIds) {
      const cardId = carddb.getVersionsByOracleId(oracleId)[0];
      const card = carddb.cardFromId(cardId);
      await processCard(card); // eslint-disable-line no-await-in-loop
      processed += 1;
      console.log(`Finished: ${processed} of ${allOracleIds.length} cards.`);
    }

    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
