// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');

const Deck = require('../models/deck');
const Draft = require('../models/draft');

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 1024;
const NOW = Date.now();

const getObjectCreatedAtPlus7 = (obj) => {
  return new Date(parseInt(obj._id.toString().slice(0, 8), 16) * 1000 + SEVEN_DAYS);
};

const processDraft = async (draft) => {
  if (draft !== null && getObjectCreatedAtPlus7(draft) < NOW) {
    if (!(await Deck.exists({ draft: draft._id }))) {
      return draft._id;
    }
  }
  return null;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  const count = await Draft.count();
  console.log(`There are ${count} drafts in the database.`);
  const cursor = Draft.find().lean().cursor();
  const drafts = [];
  for (let i = 0; i < count; i++) {
    const draftPromises = [];
    const nextBound = Math.min(i + BATCH_SIZE, count);
    for (let j = i; j < nextBound; j++) {
      // eslint-disable-next-line no-await-in-loop
      draftPromises.push(processDraft(await cursor.next()));
    }
    // eslint-disable-next-line no-await-in-loop
    drafts.push(...(await Promise.all(draftPromises)).filter((d) => d));
    i = nextBound - 1;
    console.log(`Processed ${i + 1} out of ${count} drafts, marking ${drafts.length} for deletion.`);
  }
  if (drafts.length > 0) {
    console.log(`Deleting ${drafts.length} drafts.`);
    // eslint-disable-next-line no-await-in-loop
    await Draft.deleteMany({ _id: { $in: drafts } });
  }
  mongoose.disconnect();
  process.exit();
})();
