// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const carddb = require('../serverjs/cards.js');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const CardHistory = require('../models/cardHistory');
const CardRating = require('../models/cardrating');

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];

const d = new Date();
const currentDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const cardUses = {};

const cardSizeUses = {
  size180: {},
  size360: {},
  size450: {},
  size540: {},
  size720: {},
  pauper: {},
  legacy: {},
  modern: {},
  standard: {},
  vintage: {},
};

// global cube stats
const cubeCounts = {
  total: 0,
  size180: 0,
  size360: 0,
  size450: 0,
  size540: 0,
  size720: 0,
  pauper: 0,
  legacy: 0,
  modern: 0,
  standard: 0,
  vintage: 0,
};

const correlationIndex = {};
const correlations = [];

// use correlationIndex for index
const cubesWithCard = [];

function createCorrelations() {
  const allOracleIds = carddb.allOracleIds();
  const totalCards = allOracleIds.length;
  for (let i = 0; i < totalCards; i += 1) {
    correlationIndex[allOracleIds[i]] = i;
    correlations.push([]);
    cubesWithCard.push([]);
    for (let j = 0; j < totalCards; j += 1) {
      correlations[i].push(0);
    }
    if ((i + 1) % 100 === 0) {
      console.log(`Finished: ${i + 1} of ${totalCards} correlations.`);
    }
  }
  console.log('Finish init of correlation matrix.');
}

function attemptIncrement(obj, propname) {
  if (!obj[propname]) {
    obj[propname] = 0;
  }
  obj[propname] += 1;
}

async function processDeck(deck) {
  if (deck.seats && deck.seats[0] && deck.seats[0].deck && deck.seats[0].deck.length > 0) {
    // flatten array
    const deckCards = [];
    deck.seats[0].deck.forEach((col) => {
      col.forEach((row) => {
        if (row && row.cardID) {
          deckCards.push(carddb.cardFromId(row.cardID).oracle_id);
        }
      });
    });

    for (let i = 0; i < deckCards.length; i += 1) {
      // could be an invalid card
      if (correlationIndex[deckCards[i]] && !basics.includes(deckCards[i])) {
        for (let j = i + 1; j < deckCards.length; j += 1) {
          if (!basics.includes(deckCards[j])) {
            try {
              correlations[correlationIndex[deckCards[j]]][correlationIndex[deckCards[i]]] += 1;
              correlations[correlationIndex[deckCards[j]]][correlationIndex[deckCards[i]]] += 1;
            } catch (err) {
              console.log(`${deckCards[i]} or ${deckCards[j]} cannot be indexed.`);
            }
          }
        }
      }
    }
  }
}

async function processCube(cube) {
  let cubeSizeDict = cardSizeUses.size180;
  let cubeLegalityDict = cardSizeUses.vintage;

  cubeCounts.total += 1;
  if (cube.card_count <= 180) {
    cubeSizeDict = cardSizeUses.size180;
    cubeCounts.size180 += 1;
  } else if (cube.card_count <= 360) {
    cubeSizeDict = cardSizeUses.size360;
    cubeCounts.size360 += 1;
  } else if (cube.card_count <= 450) {
    cubeSizeDict = cardSizeUses.size450;
    cubeCounts.size450 += 1;
  } else if (cube.card_count <= 540) {
    cubeSizeDict = cardSizeUses.size540;
    cubeCounts.size540 += 1;
  } else {
    cubeSizeDict = cardSizeUses.size720;
    cubeCounts.size720 += 1;
  }

  const isPauper = false;
  if (cube.type) {
    if (cube.type.toLowerCase().includes('standard')) {
      cubeLegalityDict = cardSizeUses.standard;
      cubeCounts.standard += 1;
    } else if (cube.type.toLowerCase().includes('modern')) {
      cubeLegalityDict = cardSizeUses.modern;
      cubeCounts.modern += 1;
    } else if (cube.type.toLowerCase().includes('legacy')) {
      cubeLegalityDict = cardSizeUses.legacy;
      cubeCounts.legacy += 1;
    } else if (cube.type.toLowerCase().includes('vintage')) {
      cubeLegalityDict = cardSizeUses.vintage;
      cubeCounts.vintage += 1;
    }

    if (cube.type.toLowerCase().includes('pauper')) {
      cubeLegalityDict = cardSizeUses.pauper;
      cubeCounts.pauper += 1;
    }
  }

  cube.cards.forEach((card) => {
    const { oracle_id } = carddb.cardFromId(card.cardID);
    if (correlationIndex[oracle_id]) {
      cubesWithCard[correlationIndex[oracle_id]].push(cube._id);
    }

    // total
    attemptIncrement(cardUses, oracle_id);

    // card counts collated by cube sizes
    attemptIncrement(cubeSizeDict, oracle_id);

    // card counts collated by cube type
    attemptIncrement(cubeLegalityDict, oracle_id);
    if (isPauper) {
      attemptIncrement(cardSizeUses.pauper, oracle_id);
    }
  });
}

async function processCard(card) {
  const versions = carddb.getVersionsByOracleId(card.oracle_id);
  const { name, oracle_id } = card;

  const rating = await CardRating.findOne({ name });

  const currentDatapoint = {};
  currentDatapoint.rating = rating ? rating.rating : null;
  currentDatapoint.elo = rating ? rating.elo : null;
  currentDatapoint.picks = rating ? rating.picks : 0;
  // currentDatapoint.embedding = embeddings[card.name_lower];

  currentDatapoint.total = cardUses[oracle_id] ? [cardUses[oracle_id], cardUses[oracle_id] / cubeCounts.total] : [0, 0];
  for (const cubeCategory of Object.keys(cardSizeUses)) {
    currentDatapoint[cubeCategory] = cardSizeUses[cubeCategory][oracle_id]
      ? [cardSizeUses[cubeCategory][oracle_id], cardSizeUses[cubeCategory][oracle_id] / cubeCounts[cubeCategory]]
      : [0, 0];
  }

  const cubes = cubesWithCard[correlationIndex[oracle_id]] || [];
  currentDatapoint.cubes = cubes.length;

  currentDatapoint.prices = versions.map((id) => {
    const versionPrice = { version: id };
    const { prices } = carddb.cardFromId(id);
    if (prices.usd) {
      versionPrice.price = prices.usd;
    }
    if (prices.usd_foil) {
      versionPrice.price_foil = prices.usd_foil;
    }
    return versionPrice;
  });

  // cubed with
  // create correl dict
  const cubedWith = carddb.allOracleIds().map((otherOracleId) => ({
    other: otherOracleId,
    count: correlations[correlationIndex[oracle_id]][correlationIndex[otherOracleId]],
  }));

  // quickselect isn't sorting correctly for some reason
  cubedWith.sort((first, second) => {
    return second.count - first.count;
  });

  let cardHistory = await CardHistory.findOne({ oracleId: oracle_id });
  try {
    if (!cardHistory) {
      cardHistory = new CardHistory();
      cardHistory.cardName = name;
      cardHistory.oracleId = oracle_id; // eslint-disable-line camelcase
      cardHistory.versions = versions;
    } else if(!cardHistory.oracleId || cardHistory.oracleId.length === 0) {
      cardHistory.oracle_id = oracle_id;
    }

    cardHistory.cubes = cubes;
    cardHistory.current = currentDatapoint;
    cardHistory.cubedWith = cubedWith.slice(0, 100);

    if (!cardHistory.history) {
      cardHistory.history = [];
    }

    cardHistory.history.push({
      date: currentDate,
      data: currentDatapoint,
    });

    await cardHistory.save();
  } catch (error) {
    console.error(error);
    console.log(card);
  }
}

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    console.log('creating correlation matrix...');
    createCorrelations();

    // process all cube objects
    console.log('Started: cubes');
    let count = await Cube.countDocuments();
    let cursor = Cube.find().lean().cursor();
    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await processCube(await cursor.next());
      if ((i + 1) % 10 === 0) {
        console.log(`Finished: ${i + 1} of ${count} cubes.`);
      }
    }
    console.log('Finished: all cubes');

    // process all deck objects
    console.log('Started: decks');
    count = await Deck.countDocuments();
    cursor = Deck.find().lean().cursor();
    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await processDeck(await cursor.next());
      if ((i + 1) % 1000 === 0) {
        console.log(`Finished: ${i + 1} of ${count} decks.`);
      }
    }
    console.log('Finished: all decks');

    // save card models
    const allOracleIds = carddb.allOracleIds();
    const totalCards = allOracleIds.length;
    let processed = 0;
    for (const oracleId of allOracleIds) {
      const cardId = carddb.getVersionsByOracleId(oracleId)[0];
      const card = carddb.cardFromId(cardId);
      await processCard(card); // eslint-disable-line no-await-in-loop
      processed += 1;
      console.log(`Finished: ${processed} of ${totalCards} cards.`);
    }

    mongoose.disconnect();
    console.log('done');
    process.exit(); 
  });
})();
