// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Deck = require('../models/deck');
const Cube = require('../models/cube');

const batchSize = 100;

const ownerCache = {};

async function addVars(deck) {
  if (!ownerCache[deck.cube]) {
    const cube = await Cube.findById(deck.cube);
    ownerCache[deck.cube] = cube.owner;
  }
  deck.cubeOwner = ownerCache[deck.cube];
  deck.owner = deck.seats[0].userid;

  return deck.save();
}

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async (db) => {
    const count = await Deck.countDocuments();
    const cursor = Deck.find().cursor();

    // batch them in 100
    for (let i = 0; i < count; i += batchSize) {
      const decks = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const deck = await cursor.next();
          if (deck) {
            decks.push(deck);
          }
        }
      }
      await Promise.all(decks.map((deck) => addVars(deck)));
      console.log(`Finished: ${i} of ${count} decks`);
    }
    mongoose.disconnect();
    console.log('done');
  });
})();
