// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const carddb = require('../serverjs/carddb');

const Draft = require('../models/old/draft');
const GridDraft = require('../models/old/gridDraft');
const Deck = require('../models/old/deck');

const draftModel = require('../dynamo/models/draft');

const batchSize = 100;
const skip = 0;

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();

  console.log(`Moving over decks`);
  const count = await Deck.countDocuments();
  const cursor = Deck.find().skip(skip).lean().cursor();
  const starttime = new Date();

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

    let converted = withDraft.map(([deck, draft, type]) => draftModel.convertDeck(deck, draft, type));

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
  }
  process.exit();
})();
