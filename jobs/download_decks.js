// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();
const fs = require('fs');

const path = (batch) => `jobs/export/decks/${batch}.json`;

const mongoose = require('mongoose');

const Deck = require('../models/deck');
const carddb = require('../serverjs/cards.js');

const batchSize = 100;

const processDeck = (deck) => {
  const main = [];
  const side = [];

  if (deck.seats[0] && deck.seats[0].deck) {
    for (const col of deck.seats[0].deck) {
      for (const card of col) {
        if (card && card.cardID) {
          main.push(carddb.cardFromId(card.cardID).name_lower);
        }
      }
    }
  }

  if (deck.seats[0] && deck.seats[0].sideboard) {
    for (const col of deck.seats[0].sideboard) {
      for (const card of col) {
        side.push(carddb.cardFromId(card.cardID).name_lower);
      }
    }
  }

  return { main, side };
};

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // process all deck objects
    console.log('Started');
    const count = await Deck.countDocuments();
    console.log(`Counted ${count} documents`);
    const cursor = Deck.find()
      .lean()
      .cursor();

    for (let i = 0; i < count; i += batchSize) {
      const decks = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const deck = await cursor.next();
          if (deck) {
            decks.push(processDeck(deck));
          }
        }
      }

      fs.writeFileSync(path(i / batchSize), JSON.stringify(decks), 'utf8');
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks`);
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
