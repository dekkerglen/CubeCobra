// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');

const Deck = require('../models/deck');
const Draft = require('../models/draft');
const carddb = require('../serverjs/cards');
const deckutils = require('../dist/utils/deckutils');
const { loadCardToInt, writeFile } = require('./utils');

// Number of documents to process at a time
const batchSize = 100;
// Minimum size in bytes of the output files (last file may be smaller).
const minFileSize = 128 * 1024 * 1024; // 128 MB

const processDeck = async (deck, draft, cardToInt) => {
  const picks = [];
  if (!draft || !draft.initial_state || !draft.initial_state[0].length || !draft.initial_state[0][0].length) {
    return null;
  }

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
  return { picks, main, sideboard, cards, cubeid: deck.cube, username: deck.seats[0].username, date: deck.date };
};

(async () => {
  const { cardToInt } = loadCardToInt();
  await mongoose.connect(process.env.MONGODB_URL);
  // process all deck objects
  console.log('Started');
  const count = await Deck.countDocuments();
  console.log(`Counted ${count} documents`);
  const cursor = Deck.find().lean().cursor();
  let counter = 0;
  let i = 0;
  const processedDecks = [];
  while (i < count) {
    for (; Buffer.byteLength(JSON.stringify(processedDecks)) < minFileSize && i < count; i += batchSize) {
      const decks = [];
      for (let j = 0; j < Math.min(batchSize, count - i); j++) {
        // eslint-disable-next-line no-await-in-loop
        const deck = await cursor.next();
        if (
          deck &&
          deck.seats &&
          deck.seats[0] &&
          deck.seats[0].deck &&
          deck.seats[0].pickorder &&
          deck.draft &&
          deck.seats[0].sideboard &&
          deck.seats[0].pickorder.length &&
          !deck.cards &&
          !deck.seats[0].bot
        ) {
          decks.push(deck);
        }
      }
      const draftIds = decks.map(({ draft }) => draft);
      // eslint-disable-next-line no-await-in-loop
      const drafts = await Draft.find({ _id: { $in: draftIds } }).lean();
      const draftsById = Object.fromEntries(drafts.map((draft) => [draft._id, draft]));
      const deckQs = decks.map((deck) => processDeck(deck, draftsById[deck.draft], cardToInt));
      // eslint-disable-next-line no-await-in-loop
      processedDecks.push(...(await Promise.all(deckQs)).filter((d) => d));
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks`);
    }
    if (processedDecks.length > 0) {
      const filename = `drafts/${counter.padStart(6, '0')}.json`;
      writeFile(filename, processedDecks);
      counter += 1;
      console.log(`Wrote file ${filename} with ${processedDecks.length} decks.`);
      processedDecks.length = 0;
    }
  }
  mongoose.disconnect();
  console.log('done');
  process.exit();
})();
