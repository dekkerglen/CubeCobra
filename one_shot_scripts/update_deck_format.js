require('dotenv').config();

// eslint-disable-next-line import/extensions
const mongoose = require('mongoose');
const Deck = require('../models/deck.js');
const carddb = require('../serverjs/cards');
const cubefn = require('../serverjs/cubefn');

const batchSize = 100;

let basics;
let basicsList;

const migrateDeck = async (deck) => {
  if (deck.cards && deck.cards.length !== 0) {
    return null;
  }
  const cards = [];
  for (const seat of deck.seats || []) {
    seat.deck = (seat.deck || []).map((pack) =>
      pack.map((card) => {
        cards.push(card);
        return cards.length - 1;
      }),
    );
    seat.sideboard = (seat.sideboard || []).map((pack) =>
      pack.map((card) => {
        cards.push(card);
        return cards.length - 1;
      }),
    );
    seat.pickorder = (seat.pickorder || []).map((card) => cards.findIndex((card2) => card.cardID === card2.cardID));
  }
  deck.cards = cards.concat(basicsList);
  return deck;
};

(async () => {
  await carddb.initializeCardDb();
  basics = cubefn.getBasics(carddb);
  basicsList = [basics.Plains, basics.Island, basics.Swamp, basics.Mountain, basics.Forest, basics.Wastes];
  await mongoose.connect(process.env.MONGODB_URL);
  const count = await Deck.countDocuments();
  const cursor = Deck.find().lean().cursor();
  for (let i = 0; i < count; i += batchSize) {
    const decks = [];
    for (let j = 0; j < batchSize; j++) {
      if (i + j < count) {
        // eslint-disable-next-line no-await-in-loop
        const deck = await cursor.next();
        if (deck) {
          decks.push(migrateDeck(deck));
        }
      }
    }
    // eslint-disable-next-line no-await-in-loop
    const operations = (await Promise.all(decks))
      .filter((deck) => deck)
      .map((deck) => ({
        replaceOne: {
          filter: { _id: deck._id },
          replacement: deck,
        },
      }));
    if (operations.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await Deck.bulkWrite(operations);
    }
    console.log(`Finished: ${i + batchSize} of ${count} decks`);
  }

  mongoose.disconnect();
  console.log('done');
})();
