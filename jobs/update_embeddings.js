// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const fetch = require('node-fetch');

const { GetPrices } = require('../serverjs/prices');
const carddb = require('../serverjs/cards.js');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const CardHistory = require('../models/cardHistory');
const CardRating = require('../models/cardrating');

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];

const d = new Date();
const currentDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const embeddings = {};

function attemptIncrement(obj, propname) {
  if (!obj[propname]) {
    obj[propname] = 0;
  }
  obj[propname] += 1;
}

async function processCard(card) {
  const { oracle_id } = card;

  const cardHistory = await CardHistory.findOne({ oracleId: oracle_id });
  try {
    if (cardHistory) {
      cardHistory.current = currentDatapoint.embedding = embeddings[card.name_lower];
      await cardHistory.save();
    }
  } catch (error) {
    console.error(error);
    console.log(card);
  }
}

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    console.log('fetching embeddings...');

    const allIds = carddb.allOracleIds();
    const batchSize = 500;
    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i * batchSize, (i + 1) * batchSize);

      const response = await fetch(`${process.env.FLASKROOT}/embeddings/`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: batch.map((oracleId) => carddb.getVersionsByOracleId(oracleId)[0].name_lower),
        }),
      });
      if (response.ok) {
        const json = await response.json();

        for (const key of Object.keys(json)) {
          embeddings[key] = json[key];
        }
      } else {
        console.log(`Missed an embedding batch`);
        i -= batchSize;
      }
    }

    // save card models
    const allOracleIds = carddb.allOracleIds();
    const totalCards = allOracleIds.length;
    let processed = 0;
    for (const oracleId of allOracleIds) {
      const cardId = carddb.getVersionsByOracleId(oracleId)[0];
      const card = carddb.cardFromId(cardId);
      await processCard(card); // eslint-disable-line no-await-in-loop
      processed += 1;
      console.log(`Finished: ${processed} of ${totalCards} cards.`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
