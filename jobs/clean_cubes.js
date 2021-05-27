/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');
const carddb = require('../serverjs/cards');

const batchSize = 1000;
const COLORS = ['W', 'U', 'B', 'R', 'G'];

const isInvalidCardId = (id) => carddb.cardFromId(id).name === 'Invalid Card';
const isInvalidFinish = (finish) => !['Foil', 'Non-foil'].includes(finish);
const isInvalidStatus = (status) => !['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].includes(status);
const isInvalidColors = (colors) => !colors || !Array.isArray(colors) || colors.some((c) => !COLORS.includes(c));
const DEFAULT_FINISH = 'Non-foil';
const DEFAULT_STATUS = 'Not Owned';
const DEFAULT_BASICS = [
  '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
  '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
  '19e71532-3f79-4fec-974f-b0e85c7fe701',
  '8365ab45-6d78-47ad-a6ed-282069b0fabc',
  '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
];

const needsCleaning = (cube) => {
  if (!cube.cards || !Array.isArray(cube.basics)) {
    return true;
  }

  if (
    cube.cards.some(
      (card) =>
        !card ||
        isInvalidCardId(card.cardID) ||
        isInvalidFinish(card.finish) ||
        isInvalidStatus(card.status) ||
        isInvalidColors(card.colors),
    )
  ) {
    return true;
  }

  return false;
};

const processCube = async (leanCube) => {
  if (needsCleaning(leanCube)) {
    const cube = await Cube.findById(leanCube._id);

    console.log(`Cleaning cube ${cube.name}: ${cube._id}`);

    if (!cube.cards) {
      cube.cards = [];
    }
    if (!cube.basics) {
      cube.basics = DEFAULT_BASICS;
    }
    cube.cards = cube.cards.filter((c) => c && !isInvalidCardId(c.cardID));
    for (const card of cube.cards) {
      if (isInvalidFinish(card.finish)) card.finish = DEFAULT_FINISH;
      if (isInvalidStatus(card.status)) card.status = DEFAULT_STATUS;
      if (isInvalidColors(card.colors)) card.colors = carddb.cardFromId(card.cardID).color_identity;
    }

    await cube.save();
  }
};

try {
  (async () => {
    await carddb.initializeCardDb();
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();

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

      await Promise.all(cubes.map(processCube));

      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} cubes`);
    }

    mongoose.disconnect();
    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
