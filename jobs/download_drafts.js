// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');
const AWS = require('aws-sdk');

const Deck = require('../models/deck');
const Draft = require('../models/draft');
const carddb = require('../serverjs/cards.js');
const deckutils = require('../dist/drafting/deckutils');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const monthNames = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const date = new Date();
const folder = `${monthNames[date.getMonth()]}${date.getDate()}`;

const batchSize = 1000;

let cardToInt;

const processDeck = async (deck, draft) => {
  const picks = [];
  if (!draft || !draft.initial_state || !draft.initial_state[0].length || !draft.initial_state[0][0].length) {
    return null;
  }

  const seen = [];
  let index = 0;
  const { pickorder } = deck.seats[0];
  for (const card of pickorder) {
    // named import doesn't work for some reason
    // eslint-disable-next-line import/no-named-as-default-member
    let cardsInPack;
    let pick;
    let pack;
    try {
      [cardsInPack, pick, pack] = deckutils.default.getPackAsSeen(draft.initial_state, index, deck, 0); // eslint-disable-line prefer-const
    } catch (e) {
      console.warn(e);
      return null;
    }
    cardsInPack = cardsInPack.filter((c) => c && c.cardID);
    if (cardsInPack.length === 0) {
      return null;
    }
    // eslint-disable-next-line no-loop-func
    cardsInPack = cardsInPack.map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
    seen.push(...cardsInPack);
    const picked = deck.seats[0].pickorder
      .slice(0, index)
      // eslint-disable-next-line no-loop-func
      .map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
    const chosenCard = cardToInt[carddb.cardFromId(card.cardID).name_lower];
    const packs = draft.initial_state[0].length;
    const packSize = draft.initial_state[0][pack].length;
    picks.push({ pack, packs, pick, packSize, picked, cardsInPack, chosenCard, seen: [...seen] });
    index += 1;
  }
  const main = deck.seats[0].deck.flat(2).map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
  const sideboard = deck.seats[0].sideboard.flat(2).map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
  const cards = draft.initial_state.flat(3).map((c) => cardToInt[carddb.cardFromId(c.cardID).name_lower]);
  return { picks, main, sideboard, cards };
};

const writeToS3 = async (fileName, body) => {
  const params = {
    Bucket: 'cubecobra',
    Key: `${folder}/${fileName}`,
    Body: JSON.stringify(body),
  };
  await s3.upload(params).promise();
};

(async () => {
  await carddb.initializeCardDb();
  const cardNames = new Set(carddb.allCards().map((c) => c.name_lower));
  cardToInt = Object.fromEntries([...cardNames].map((name, index) => [name, index]));
  const intToCard = new Array([...cardNames].length);
  for (const card of carddb.allCards()) {
    intToCard[cardToInt[card.name_lower]] = card;
  }

  await Promise.all([writeToS3('cardToInt.json', cardToInt), writeToS3('intToCard.json', intToCard)]);

  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // process all deck objects
    console.log('Started');
    const count = await Deck.countDocuments();
    console.log(`Counted ${count} documents`);
    const cursor = Deck.find().lean().cursor();
    let counter = 0;
    for (let i = 0; i < count; i += batchSize) {
      const decks = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
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
      }
      // eslint-disable-next-line no-await-in-loop
      const drafts = await Draft.find({ _id: { $in: decks } }).lean();
      const draftsById = Object.fromEntries(drafts.map((draft) => [draft._id, draft]));
      const deckQs = decks.map((deck) => processDeck(deck, draftsById[deck.draft]));
      // eslint-disable-next-line no-await-in-loop
      const processedDecks = (await Promise.all(deckQs)).filter((d) => d);
      if (processedDecks.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await writeToS3(`drafts/${counter}.json`, processedDecks);
        counter += 1;
      }
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} decks`);
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
