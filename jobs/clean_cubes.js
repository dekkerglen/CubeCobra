/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');
const User = require('../models/user');
const { cardsNeedsCleaning, cleanCards } = require('../models/migrations/cleanCards');
const carddb = require('../serverjs/cards');
const util = require('../serverjs/util');

const DEFAULT_BASICS = [
  '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
  '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
  '19e71532-3f79-4fec-974f-b0e85c7fe701',
  '8365ab45-6d78-47ad-a6ed-282069b0fabc',
  '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
];

const BATCH_SIZE = 1024;

const needsCleaning = (cube) =>
  !cube.cards ||
  !Array.isArray(cube.basics) ||
  cardsNeedsCleaning(cube.cards) ||
  cardsNeedsCleaning(cube.maybe) ||
  cube.tags.some((tag) => !tag || tag.toLowerCase() !== tag);

const processCube = async (leanCube, admin) => {
  if (needsCleaning(leanCube)) {
    const cube = await Cube.findById(leanCube._id);

    console.debug(`Cleaning cube ${cube.name}: ${cube._id}`);
    if (!cube.cards) {
      cube.cards = [];
    }
    if (!cube.maybe) {
      cube.maybe = [];
    }
    const oldCardCount = cube.cards.length;
    const oldMaybeCount = cube.cards.length;
    if (!Array.isArray(cube.basics)) {
      cube.basics = DEFAULT_BASICS;
    }
    if (cardsNeedsCleaning(cube.cards)) {
      cube.cards = cleanCards(cube.cards);
    }
    if (cardsNeedsCleaning(cube.maybe)) {
      cube.maybe = cleanCards(cube.maybe);
    }
    if (cube.tags.some((tag) => !tag || tag.toLowerCase() !== tag)) {
      cube.tags = cube.tags.filter((tag) => tag && tag.length > 0).map((tag) => tag.toLowerCase());
    }
    await cube.save();

    const cardDiff = cube.cards.length - oldCardCount;
    const maybeDiff = cube.maybe.length - oldMaybeCount;
    if (!cardDiff && !maybeDiff) return;

    const owner = await User.findById(cube.owner);
    if (cardDiff)
      await util.addNotification(
        owner,
        admin,
        `/cube/list/${cube.id}`,
        `${cardDiff} invalid card${cardDiff === 1 ? ' was' : 's were'} automatically removed from your cube ${
          cube.name
        }`,
      );

    if (maybeDiff)
      await util.addNotification(
        owner,
        admin,
        `/cube/list/${cube.id}`,
        `${maybeDiff} invalid card${maybeDiff === 1 ? ' was' : 's were'} automatically removed from your cube ${
          cube.name
        }`,
      );
  }
};

try {
  (async () => {
    await carddb.initializeCardDb();
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments();
    const admin = await User.findOne({ roles: 'Admin' }).lean();
    const cursor = Cube.find().lean().cursor();

    // batch them by batchSize
    for (let i = 0; i < count; ) {
      const cubes = [];
      const nextBound = Math.min(i + BATCH_SIZE, count);
      for (; i < nextBound; i++) {
        const cube = await cursor.next();
        if (cube) {
          cubes.push(processCube(cube, admin));
        }
      }

      await Promise.all(cubes);

      console.log(`Finished: ${i} of ${count} cubes`);
    }

    await mongoose.disconnect();
    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
