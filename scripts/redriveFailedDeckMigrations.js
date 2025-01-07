// Load Environment Variables
require('dotenv').config();

const fs = require('fs');

const mongoose = require('mongoose');
const carddb = require('../serverjs/carddb');

const Draft = require('../models/old/draft');
const GridDraft = require('../models/old/gridDraft');
const Deck = require('../models/old/deck');

const draftModel = require('../dynamo/models/draft');

const enrichWithDraft = async (deck) => {
  if (deck.draft) {
    const draft = await Draft.findById(deck.draft).lean();

    if (draft) {
      return [deck, draft, draftModel.TYPES.DRAFT];
    }

    const grid = await GridDraft.findById(deck.draft).lean();

    if (grid) {
      return [deck, grid, draftModel.TYPES.GRID];
    }
  }

  return [deck, {}, draftModel.TYPES.DRAFT];
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();

  console.log(`Moving over decks`);
  const failed = JSON.parse(fs.readFileSync('./temp/failed.txt', 'utf8'));
  const count = failed.length;

  console.log(`Deck: Found ${count} items. Starting migration...`);

  for (let i = 0; i < count; i += 1) {
    const item = failed[i];

    let converted;
    let withDraft;

    const deck = await Deck.findById(item.deck).lean();
    try {
      withDraft = await enrichWithDraft(deck);
      converted = draftModel.convertDeck(deck, withDraft[1], withDraft[2]);
      await draftModel.batchPut(converted);
    } catch (err) {
      // console.log(withDraft);
      console.log(converted);
      // console.log(deck);
      console.log(err);
      // console.log(item);
      process.exit();
    }
    console.log(`Deck: Finished: ${i} of ${count} items`);
  }
  process.exit();
})();
