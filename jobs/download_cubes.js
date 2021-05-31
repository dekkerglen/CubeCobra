/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const AWS = require('aws-sdk');
const Cube = require('../models/cube');
const carddb = require('../serverjs/cards.js');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const batchSize = 1000;

const processCube = (cube) => {
  const {
    date_updated,
    numDecks,
    type,
    name,
    owner,
    owner_name,
    tags,
    image_uri,
    image_artist,
    image_name,
    card_count,
    users_following,
  } = cube;

  return {
    cards: cube.cards.map((card) => carddb.cardFromId(card.cardID).name_lower),
    id: cube._id,
    date_updated,
    numDecks,
    type,
    name,
    owner,
    owner_name,
    tags,
    image_uri,
    image_artist,
    image_name,
    card_count,
    users_following,
  };
};

try {
  (async () => {
    await carddb.initializeCardDb();
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments({ isListed: true });
    const cursor = Cube.find({ isListed: true }).lean().cursor();

    // batch them by batchSize
    for (let i = 0; i < count; i += batchSize) {
      const cubes = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const cube = await cursor.next();
          if (cube) {
            cubes.push(cube);
          }
        }
      }
      const params = {
        Bucket: 'cubecobra',
        Key: `cube_exports/${i / batchSize}.json`,
        Body: JSON.stringify(cubes.map(processCube)),
      };
      await s3.upload(params).promise();

      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} cubes`);
    }
    mongoose.disconnect();

    const params = {
      Bucket: 'cubecobra',
      Key: `cube_exports/manifest.json`,
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
