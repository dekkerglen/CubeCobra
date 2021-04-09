// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const Deck = require('../models/deck');
const Draft = require('../models/draft');
const Cube = require('../models/cube');
const CubeAnalytic = require('../models/cubeAnalytic');
const carddb = require('../serverjs/cards.js');
const { newCardAnalytics, getEloAdjustment } = require('../serverjs/cubefn');

const ELO_BASE = 1200;
const CUBE_ELO_SPEED = 10;

const getPackAsSeen = (initialState, index, deck) => {
  const cardsInPack = [];

  let start = 0;
  let end = initialState[0][0].length;
  let pack = 0;
  let current = parseInt(0, 10);
  let picks = parseInt(index, 10);

  while (picks >= initialState[0][pack].length) {
    start = end;
    end += initialState[0][pack].length;
    picks -= initialState[0][pack].length;
    pack += 1;
  }

  for (let i = start + picks; i < end; i += 1) {
    cardsInPack.push(deck.seats[current].pickorder[i]);
    if (pack % 2 !== initialState[0].length % 2) {
      current += 1;
      current %= initialState.length;
    } else {
      current -= 1;
      if (current < 0) {
        current = initialState.length - 1;
      }
    }
  }

  return cardsInPack.map(({ cardID }) => carddb.cardFromId(cardID).name_lower);
};

const processPick = (pick, pack, analytic) => {
  let pickIndex = analytic.cards.findIndex((card) => card.cardName === pick);
  if (pickIndex === -1) {
    pickIndex = analytic.cards.push(newCardAnalytics(pick, ELO_BASE)) - 1;
  }

  const packIndeces = {};
  for (const packCard of pack) {
    let index = analytic.cards.findIndex((card) => card.cardName === packCard);
    if (index === -1) {
      index = analytic.cards.push(newCardAnalytics(packCard, ELO_BASE)) - 1;
    }
    packIndeces[packCard] = index;

    const adjustments = getEloAdjustment(analytic.cards[pickIndex].elo, analytic.cards[index].elo, CUBE_ELO_SPEED);
    analytic.cards[pickIndex].elo += adjustments[0];
    analytic.cards[index].elo += adjustments[1];

    analytic.cards[index].passes += 1;
  }

  analytic.cards[pickIndex].picks += 1;
};

const processDraft = (draft, deck, analytic) => {
  if (draft.seats[0] && !draft.seats[0].bot) {
    for (let i = 0; i < deck.seats[0].pickorder.length; i++) {
      const pack = getPackAsSeen(draft.initial_state, i, deck);
      const [pick] = pack.splice(0, 1);
      processPick(pick, pack, analytic);
    }
  }
};

const processDeck = async (deck, analytic) => {
  if (!deck.bot) {
    for (const col of deck.seats[0].deck) {
      for (const current of col) {
        let pickIndex = analytic.cards.findIndex(
          (card) => card.cardName.toLowerCase() === carddb.cardFromId(current.cardID).name.toLowerCase(),
        );
        if (pickIndex === -1) {
          pickIndex =
            analytic.cards.push(newCardAnalytics(carddb.cardFromId(current.cardID).name.toLowerCase(), 1200)) - 1;
        }
        analytic.cards[pickIndex].mainboards += 1;
      }
    }
    for (const col of deck.seats[0].sideboard) {
      for (const current of col) {
        let pickIndex = analytic.cards.findIndex(
          (card) => card.cardName.toLowerCase() === carddb.cardFromId(current.cardID).name.toLowerCase(),
        );
        if (pickIndex === -1) {
          pickIndex =
            analytic.cards.push(newCardAnalytics(carddb.cardFromId(current.cardID).name.toLowerCase(), 1200)) - 1;
        }
        analytic.cards[pickIndex].sideboards += 1;
      }
    }
  }

  if (deck.draft) {
    const draft = await Draft.findOne({ _id: deck.draft });
    try {
      processDraft(draft, deck, analytic);
    } catch (error) {
      console.error(error);
    }
  }
};

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();

    for (let i = 0; i < count; i++) {
      const cube = await cursor.next();
      let cubeAnalytic = await CubeAnalytic.findOne({ cube: cube._id });
      if (!cubeAnalytic) {
        cubeAnalytic = new CubeAnalytic();
        cubeAnalytic.cube = cube._id;
      }
      cubeAnalytic.cards = [];

      const decks = await Deck.find({ cube: cube._id });
      for (const deck of decks) {
        await processDeck(deck, cubeAnalytic);
      }

      console.log(`For cube "${cube.name}", saving ${decks.length} decks`);

      await cubeAnalytic.save();
      console.log(`Finished: ${Math.min(count, i + 1)} of ${count} cubes`);
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
