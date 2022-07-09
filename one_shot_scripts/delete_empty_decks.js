/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const AWS = require('aws-sdk');
const Deck = require('../models/deck');
const carddb = require('../serverjs/cards');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const batchSize = 10000;
let deleted = 0;

const processDeck = async (deck) => {
  try {
    let cardCount = 0;
    for (const row of deck.seats[0].deck) {
      for (const col of row) {
        cardCount += col.length;
      }
    }

    if (cardCount === 0) {
      await Deck.deleteOne({ _id: deck._id });
      deleted += 1;
    }
  } catch (e) {
    console.log(`Error processing deck ${deck._id}: ${e}`);
  }
};

try {
  (async () => {
    await carddb.initializeCardDb();
    await mongoose.connect(process.env.MONGODB_URL);

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
            decks.push(deck);
          }
        }
      }
      await Promise.all(decks.map(processDeck));
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks, deleted ${deleted}`);
    }
    await mongoose.disconnect();

    const params = {
      Bucket: 'cubecobra',
      Key: `deck_exports/manifest.json`,
      Body: JSON.stringify({ date_exported: new Date() }),
    };
    await s3.upload(params).promise();

    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
