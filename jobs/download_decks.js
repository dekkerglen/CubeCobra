// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const AWS = require('aws-sdk');
const Deck = require('../models/deck');
const carddb = require('../serverjs/cards.js');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const batchSize = 1000;

const folder = 'august2';

const processDeck = (deck) => {
  const main = [];
  const side = [];

  if (deck.seats[0] && deck.seats[0].deck) {
    for (const col of deck.seats[0].deck) {
      for (const cardIndex of col) {
        const card = deck.cards[cardIndex];
        if (card && card.cardID) {
          main.push(carddb.cardFromId(card.cardID).name_lower);
        }
      }
    }
  }

  if (deck.seats[0] && deck.seats[0].sideboard) {
    for (const col of deck.seats[0].sideboard) {
      for (const cardIndex of col) {
        side.push(carddb.cardFromId(deck.cards[cardIndex].cardID).name_lower);
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
    const cursor = Deck.find().lean().cursor();

    for (let i = 0; i < count; i += batchSize) {
      const decks = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const deck = await cursor.next(); // eslint-disable-line no-await-in-loop
          if (deck) {
            decks.push(processDeck(deck));
          }
        }
      }
      const params = {
        Bucket: 'cubecobra', // pass your bucket name
        Key: `${folder}/decks/${i / batchSize}.json`, // file will be saved as testBucket/contacts.csv
        Body: JSON.stringify(decks),
      };
      await s3.upload(params).promise(); // eslint-disable-line no-await-in-loop
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks`);
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
