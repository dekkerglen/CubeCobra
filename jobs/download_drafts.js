// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');

require('../models/mongoinit');
const Deck = require('../models/deck');
const Draft = require('../models/draft');
const carddb = require('../serverjs/cards');
const deckutils = require('../dist/utils/deckutils');
const { getObjectCreatedAt, loadCardToInt, writeFile } = require('./utils');

// Number of documents to process at a time
const batchSize = 256;
// Minimum size in bytes of the output files (last file may be smaller).
const minFileSize = 128 * 1024 * 1024; // 128 MB

const processDeck = async (deck, draft, cardToInt) => {
  const picks = [];
  const seen = [];
  let index = 0;
  const { pickorder } = deck.seats[0];
  for (const card of pickorder) {
    let cardsInPack;
    let pick;
    let pack;
    try {
      [cardsInPack, pick, pack] = deckutils.default.getPackAsSeen(draft.initial_state, index, deck, 0);
    } catch (e) {
      console.warn(e);
      return null;
    }
    cardsInPack = cardsInPack.filter((c) => c && c.cardID);
    if (cardsInPack.length === 0) {
      return null;
    }
    const localCardToInt = cardToInt;
    cardsInPack = cardsInPack.map((c) => localCardToInt[carddb.cardFromId(c.cardID).name_lower]);
    seen.push(...cardsInPack);
    const picked = deck.seats[0].pickorder
      .slice(0, index)
      .map((c) => localCardToInt[carddb.cardFromId(c.cardID).name_lower]);
    const chosenCard = cardToInt[carddb.cardFromId(card.cardID).name_lower];
    const packs = draft.initial_state[0].length;
    const packSize = draft.initial_state[0][pack].length;
    picks.push({ pack, packs, pick, packSize, picked, cardsInPack, chosenCard, seen: [...seen] });
    index += 1;
  }
  const main = deck.seats[0].deck.flat(2).map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
  const sideboard = deck.seats[0].sideboard.flat(2).map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
  const cards = draft.initial_state.flat(3).map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
  return {
    picks,
    main,
    sideboard,
    cards,
    cubeid: deck.cube,
    username: deck.seats[0].username,
    date: deck.date,
    deckid: deck._id,
    draftid: draft._id,
    createdAt: getObjectCreatedAt(draft._id),
    deckCreatedAt: getObjectCreatedAt(deck._id),
  };
};

const isValidDraft = (draft) =>
  draft &&
  draft.initial_state &&
  draft.initial_state[0] &&
  draft.initial_state[0].length &&
  draft.initial_state[0][0].length;
const isValidDeck = (deck) =>
  deck &&
  deck.draft &&
  deck.seats &&
  deck.seats[0] &&
  deck.seats[0].deck &&
  deck.seats[0].pickorder &&
  deck.seats[0].sideboard &&
  deck.seats[0].pickorder.length &&
  !deck.seats[0].bot;

(async () => {
  const { cardToInt } = await loadCardToInt();
  await mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  // process all deck objects
  const count = await Deck.countDocuments();
  console.log(`Counted ${count} documents`);
  const cursor = Deck.find().lean().cursor();
  let counter = 0;
  let i = 0;
  while (i < count) {
    const processedDecks = [];
    let size = 0;
    for (; size < minFileSize && i < count; ) {
      const decks = [];
      const nextBound = Math.min(i + batchSize, count);
      for (; i < nextBound; i++) {
        // eslint-disable-next-line no-await-in-loop
        const deck = await cursor.next();
        if (isValidDeck(deck)) {
          decks.push(deck);
        }
      }
      const draftIds = [...new Set(decks.map(({ draft }) => draft))];
      // eslint-disable-next-line no-await-in-loop
      const drafts = await Draft.find({ _id: { $in: draftIds } }).lean();
      const draftsById = Object.fromEntries(drafts.map((draft) => [draft._id, draft]));
      const deckQs = decks
        .filter((deck) => isValidDraft(draftsById[deck.draft]))
        .map((deck) => processDeck(deck, draftsById[deck.draft], cardToInt));
      // eslint-disable-next-line no-await-in-loop
      const processingDecks = (await Promise.all(deckQs)).filter((d) => d);
      size += Buffer.byteLength(JSON.stringify(processingDecks));
      processedDecks.push(...processingDecks);
      console.log(`Finished: ${i} of ${count} decks and the buffer is approximately ${(size / 1024 / 1024).toFixed(2)} MB.`);
    }
    if (processedDecks.length > 0) {
      const filename = `drafts/${counter.toString().padStart(6, '0')}.json`;
      writeFile(filename, processedDecks);
      counter += 1;
      console.log(`Wrote file ${filename} with ${processedDecks.length} decks.`);
    }
  }
  mongoose.disconnect();
  console.log('done');
  process.exit();
})();
