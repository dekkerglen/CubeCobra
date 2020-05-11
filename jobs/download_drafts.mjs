/* eslint-disable import/extensions */
// Load Environment Variables
import dotenv from 'dotenv';
import fs from 'fs';
import mongoose from 'mongoose';

import Deck from '../models/deck.js';
import Draft from '../models/draft.js';
import carddb from '../serverjs/cards.js';
import deckutils from '../src/utils/deckutils.js';

dotenv.config();

const path = (batch) => `jobs/export/drafts/${batch}.json`;

const batchSize = 100;

const processDeck = async (deck) => {
  const picks = [];

  const draft = await Draft.findOne({ _id: deck.draft }).lean();

  if (deck.seats[0] && deck.seats[0].pickorder) {
    deck.seats[0].pickorder.forEach((card, index) => {
      // named import doesn't work for some reason
      // eslint-disable-next-line import/no-named-as-default-member
      const { cardsInPack, pack, pick } = deckutils
        .getCardsInPack(0, index, deck, draft)
        .map((c) => carddb.cardFromId(c.cardID).name_lower);
      const pool = deck.seats[0].pickorder.slice(0, index).map((c) => carddb.cardFromId(c.cardID).name_lower);
      const picked = carddb.cardFromId(card.cardID).name_lower;
      picks.push({ pack, pick, pool, cardsInPack, picked });
    });
  }

  return picks;
};

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // process all deck objects
    console.log('Started');
    const count = await Deck.countDocuments();
    console.log(`Counted ${count} documents`);
    const cursor = Deck.find().lean().cursor();

    for (let i = 0; i < count; i += batchSize) {
      const deckQs = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          // eslint-disable-next-line no-await-in-loop
          const deck = await cursor.next();
          if (deck) {
            deckQs.push(processDeck(deck));
          }
        }
      }
      // eslint-disable-next-line no-await-in-loop
      const decks = await Promise.all([deckQs]);

      fs.writeFileSync(path(i / batchSize), JSON.stringify(decks), 'utf8');
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks`);
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
