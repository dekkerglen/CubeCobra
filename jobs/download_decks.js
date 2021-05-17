/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 download_decks.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

require('../models/mongoinit');
const Deck = require('../models/deck');
const carddb = require('../serverjs/cards.js');
const { getObjectCreatedAt, loadCardToInt, writeFile } = require('./utils');
// Number of documents to process at a time
const batchSize = 1024;
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

  return {
    main,
    side,
    cubeid: deck.cube,
    draftid: deck.draft,
    username: deck.seats[0].username,
    date: deck.date,
    createdAt: getObjectCreatedAt(deck._id),
  };
};

try {
  (async () => {
    const { cardToInt } = await loadCardToInt();
    await mongoose.connect(process.env.MONGODB_URL);

    // process all deck objects
    const count = await Deck.countDocuments();
    console.log(`Counted ${count} documents`);
    const cursor = Deck.find().lean().cursor();

    let counter = 0;
    let i = 0;
    while (i < count) {
      const decks = [];
      let size = 0;
      for (; size < minFileSize && i < count; ) {
        const processingDecks = [];
        const nextBound = Math.min(i + batchSize, count);
        for (; i < nextBound; i++) {
          // eslint-disable-next-line no-await-in-loop
          const deck = await cursor.next();
          if (deck) {
            processingDecks.push(processDeck(deck, cardToInt));
          }
        }
        size += Buffer.byteLength(JSON.stringify(processingDecks));
        decks.push(...processingDecks);
        console.log(`Finished: ${i} of ${count} decks and the buffer is approximately ${size / 1024 / 1024} MB.`);
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
} catch (err) {
  console.error(err);
  process.exit();
}
