// Load Environment Variables
require('dotenv').config();

const fs = require('fs');

const mongoose = require('mongoose');
const carddb = require('../serverjs/carddb');

const Draft = require('../models/old/draft');
const GridDraft = require('../models/old/gridDraft');
const Deck = require('../models/old/deck');

const draftModel = require('../dynamo/models/draft');

const batchSize = 100;
const skip = 1078200;

const query = {};

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();

  console.log(`Moving over decks`);
  const count = await Deck.countDocuments(query);
  const cursor = Deck.find(query).skip(skip).lean().cursor();
  const starttime = new Date();
  const failed = [];

  console.log(`Deck: Found ${count} items. Starting migration...`);

  // batch them by batchSize
  for (let i = skip; i < count; i += batchSize) {
    const items = [];
    for (let j = 0; j < batchSize; j++) {
      if (i + j < count) {
        const item = await cursor.next();
        if (item) {
          items.push(item);
        }
      }
    }

    const withDraft = await Promise.all(
      items.map(async (deck) => {
        if (deck.draft) {
          const draft = await Draft.findById(deck.draft).lean();

          if (draft) {
            return [deck, draft, draftModel.TYPES.DRAFT];
          }

          const grid = await GridDraft.findById(deck.draft).lean();

          if (grid) {
            return [deck, grid, draftModel.TYPES.GRID];
          }

          return [deck, {}, draftModel.TYPES.UPLOAD];
        }
        return [deck, {}];
      }),
    );

    let converted = [];

    for (const [deck, draft, type] of withDraft) {
      try {
        converted.push(draftModel.convertDeck(deck, draft, type));
      } catch (err) {
        failed.push({ deck: deck._id, draft: draft._id, type });
      }
    }

    // check for a 1:N relationship
    if (Array.isArray(converted[0])) {
      converted = converted.flat();
    }
    if (converted.length > 0) {
      await draftModel.batchPut(converted);
    }

    const currentTime = new Date();
    const timeElapsed = (currentTime - starttime) / 1000;
    const documentsRemaining = count - i;
    const documentProcessed = i - skip;
    const timeRemaining = (timeElapsed / documentProcessed) * documentsRemaining;
    console.log(
      `Deck: Finished: ${Math.min(i + batchSize, count)} of ${count} items. Time elapsed: ${
        Math.round(timeElapsed / 36) / 100
      } hours. Time remaining: ${Math.round(timeRemaining / 36) / 100} hours`,
    );
    // sync failed with /temp/failed.txt
    fs.writeFileSync('./temp/failed.txt', JSON.stringify(failed));
  }
  process.exit();
})();
