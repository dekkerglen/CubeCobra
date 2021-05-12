// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const Deck = require('../models/deck');
const carddb = require('../serverjs/cards.js');
const { writeFile, loadCardToInt } = require('./utils');

// Number of documents to process at a time
const batchSize = 1000;
// Minimum size in bytes of the output files (last file may be smaller).
const minFileSize = 128 * 1024 * 1024; // 128 MB

const processDeck = (deck, cardToInt) => {
  const main = [];
  const side = [];

  if (deck.seats[0] && deck.seats[0].deck) {
    for (const col of deck.seats[0].deck) {
      for (const card of col) {
        if (card && card.cardID) {
          main.push(cardToInt[carddb.cardFromId(card.cardID).name_lower]);
        }
      }
    }
  }

  if (deck.seats[0] && deck.seats[0].sideboard) {
    for (const col of deck.seats[0].sideboard) {
      for (const card of col) {
        side.push(cardToInt[carddb.cardFromId(card.cardID).name_lower]);
      }
    }
  }

  return { main, side, cubeid: deck.cube, username: deck.seats[0].username, date: deck.date };
};

(async () => {
  const { cardToInt } = await loadCardToInt();
  await mongoose.connect(process.env.MONGODB_URL);
  // process all deck objects
  console.log('Started');
  const count = await Deck.countDocuments();
  console.log(`Counted ${count} documents`);
  const cursor = Deck.find().lean().cursor();

  let counter = 0;
  let i = 0;
  const decks = [];
  while (i < count) {
    for (; Buffer.byteLength(JSON.stringify(decks)) < minFileSize && i < count; i += batchSize) {
      for (let j = 0; j < Math.min(batchSize, count - i); j++) {
        // eslint-disable-next-line no-await-in-loop
        const deck = await cursor.next();
        if (deck) {
          decks.push(processDeck(deck, cardToInt));
        }
      }
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks`);
    }
    if (decks.length > 0) {
      const filename = `decks/${counter.toString().padStart(6, '0')}.json`;
      writeFile(filename, decks);
      counter += 1;
      console.log(`Wrote file ${filename} with ${decks.length} decks.`);
      decks.length = 0;
    }
  }
  mongoose.disconnect();
  console.log('done');
  process.exit();
})();
