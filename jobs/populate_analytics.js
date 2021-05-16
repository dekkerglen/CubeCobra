// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const similarity = require('compute-cosine-similarity');
const { winston } = require('../serverjs/cloudwatch');
const carddb = require('../serverjs/cards.js');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const CardHistory = require('../models/cardHistory');
const CardRating = require('../models/cardrating');

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];

let cardUses = {};

let ratingsDict = {};

let currentDate = '';

let distinctOracles = [];

let cardSizeUses = {
  size180: {},
  size360: {},
  size450: {},
  size540: {},
  size720: {},
  pauper: {},
  peasant: {},
  legacy: {},
  modern: {},
  standard: {},
  vintage: {},
};

// global cube stats
let cubeCounts = {
  total: 0,
  size180: 0,
  size360: 0,
  size450: 0,
  size540: 0,
  size720: 0,
  pauper: 0,
  peasant: 0,
  legacy: 0,
  modern: 0,
  standard: 0,
  vintage: 0,
};

let correlationIndex = {};
let correlations = [];
let synergies = [];

// use correlationIndex for index
let cubesWithCard = [];

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
    if ((i + 1) % 1000 === 0) {
      winston.info(`Finished: ${i + 1} of ${totalCards} correlations.`);
    }
  }
  winston.info('Finish init of correlation matrix.');
}

const cardFromOracle = (oracle) => carddb.cardFromId(carddb.getVersionsByOracleId(oracle)[0]);

function getSynergy(oracle1, oracle2) {
  const em1 = cardFromOracle(oracle1).embedding;
  const em2 = cardFromOracle(oracle2).embedding;
  if (em1 && em2 && em1.length === em2.length) {
    return similarity(em1, em2);
  }
  return 0;
}

function createSynergyMatrix() {
  const allOracleIds = carddb.allOracleIds();
  for (let i = 0; i < allOracleIds.length; i += 1) {
    synergies.push([]);
    cubesWithCard.push([]);
    for (let j = 0; j < allOracleIds.length; j += 1) {
      synergies[i].push(getSynergy(allOracleIds[i], allOracleIds[j]));
    }
    if ((i + 1) % 100 === 0) {
      winston.info(`Finished: ${i + 1} of ${allOracleIds.length} synergies.`);
    }
  }
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
              winston.info(`${deckCards[i]} or ${deckCards[j]} cannot be indexed.`);
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

  let isPauper = false;
  let isPeasant = false;
  if (cube.type) {
    if (
      cube.type.toLowerCase().includes('standard') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Standard'))
    ) {
      cubeLegalityDict = cardSizeUses.standard;
      cubeCounts.standard += 1;
    } else if (
      cube.type.toLowerCase().includes('modern') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Modern'))
    ) {
      cubeLegalityDict = cardSizeUses.modern;
      cubeCounts.modern += 1;
    } else if (
      cube.type.toLowerCase().includes('legacy') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Legacy'))
    ) {
      cubeLegalityDict = cardSizeUses.legacy;
      cubeCounts.legacy += 1;
    } else if (
      cube.type.toLowerCase().includes('vintage') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Vintage'))
    ) {
      cubeLegalityDict = cardSizeUses.vintage;
      cubeCounts.vintage += 1;
    }

    if (
      cube.type.toLowerCase().includes('pauper') ||
      (cube.overrideCategory && cube.categoryPrefixes.includes('Pauper'))
    ) {
      cubeCounts.pauper += 1;
      isPauper = true;
    }

    if (
      cube.type.toLowerCase().includes('peasant') ||
      (cube.overrideCategory && cube.categoryPrefixes.includes('Peasant'))
    ) {
      cubeCounts.peasant += 1;
      isPeasant = true;
    }
  }

  const uniqueOracleIds = Array.from(
    new Set(cube.cards.filter((c) => c).map((card) => carddb.cardFromId(card.cardID).oracle_id)),
  );
  uniqueOracleIds.forEach((oracleId) => {
    if (correlationIndex[oracleId]) {
      cubesWithCard[correlationIndex[oracleId]].push(cube._id);
    }

    // total
    attemptIncrement(cardUses, oracleId);

    // card counts collated by cube sizes
    attemptIncrement(cubeSizeDict, oracleId);

    // card counts collated by cube type
    attemptIncrement(cubeLegalityDict, oracleId);
    if (isPauper) {
      attemptIncrement(cardSizeUses.pauper, oracleId);
    }
    if (isPeasant) {
      attemptIncrement(cardSizeUses.peasant, oracleId);
    }
  });
}

async function processCard(card) {
  const versions = carddb.getVersionsByOracleId(card.oracle_id);
  const { name } = card;
  const oracleId = card.oracle_id;

  const rating = ratingsDict[name]; // await CardRating.findOne({ name });

  const currentDatapoint = {};
  currentDatapoint.rating = rating ? rating.rating : null;
  currentDatapoint.elo = rating ? rating.elo : null;
  currentDatapoint.picks = rating ? rating.picks : 0;
  // currentDatapoint.embedding = embeddings[card.name_lower];

  currentDatapoint.total = cardUses[oracleId] ? [cardUses[oracleId], cardUses[oracleId] / cubeCounts.total] : [0, 0];
  for (const cubeCategory of Object.keys(cardSizeUses)) {
    currentDatapoint[cubeCategory] = cardSizeUses[cubeCategory][oracleId]
      ? [cardSizeUses[cubeCategory][oracleId], cardSizeUses[cubeCategory][oracleId] / cubeCounts[cubeCategory]]
      : [0, 0];
  }

  const cubes = cubesWithCard[correlationIndex[oracleId]] || [];
  currentDatapoint.cubes = cubes.length;

  currentDatapoint.prices = versions.map((id) => {
    const versionPrice = { version: id };
    const { prices } = carddb.cardFromId(id);
    if (prices) {
      versionPrice.price = prices.usd;
      versionPrice.price_foil = prices.usd_foil;
      versionPrice.eur = prices.eur;
      versionPrice.tix = prices.tix;
    }
    return versionPrice;
  });

  // cubed with
  // create correl dict
  const cubedWith = distinctOracles
    .map((otherOracleId) => {
      try {
        return {
          oracle: otherOracleId,
          count: correlations[correlationIndex[oracleId]][correlationIndex[otherOracleId]],
          type: cardFromOracle(otherOracleId).type.toLowerCase(),
        };
      } catch (e) {
        console.error(e);
        console.log(`oracle: ${oracleId}, other: ${otherOracleId}`);
        console.log(`index: ${correlationIndex[oracleId]}, other: ${correlationIndex[otherOracleId]}`);
        return {};
      }
    })
    .filter((item) => item.oracle !== oracleId && !item.type.includes('basic land'));

  const synergyWith = distinctOracles
    .map((otherOracleId) => ({
      oracle: otherOracleId,
      synergy: synergies[correlationIndex[oracleId]][correlationIndex[otherOracleId]],
      type: cardFromOracle(otherOracleId).type.toLowerCase(),
    }))
    .filter((item) => Number.isFinite(item.synergy) && item.oracle !== oracleId && !item.type.includes('basic'));

  // quickselect isn't sorting correctly for some reason
  cubedWith.sort((first, second) => {
    return second.count - first.count;
  });

  synergyWith.sort((first, second) => {
    if (second.synergy < first.synergy) {
      return -1;
    }
    if (second.synergy > first.synergy) {
      return 1;
    }
    return 0;
  });
  let cardHistory = await CardHistory.findOne({ oracleId });
  try {
    if (!cardHistory) {
      cardHistory = new CardHistory();
      cardHistory.cardName = name;
      cardHistory.oracleId = oracleId; // eslint-disable-line camelcase
      cardHistory.versions = versions;
    } else if (!cardHistory.oracleId || cardHistory.oracleId.length === 0) {
      cardHistory.oracle_id = oracleId;
    }

    cardHistory.cubes = cubes;
    cardHistory.current = currentDatapoint;

    cardHistory.cubedWith = {
      synergistic: synergyWith.slice(0, 24).map((item) => item.oracle),
      top: cubedWith.slice(0, 24).map((item) => item.oracle),
      creatures: cubedWith
        .filter((item) => item.type.includes('creature'))
        .slice(0, 24)
        .map((item) => item.oracle),
      spells: cubedWith
        .filter((item) => item.type.includes('instant') || item.type.includes('sorcery'))
        .slice(0, 24)
        .map((item) => item.oracle),
      other: cubedWith
        .filter(
          (item) => !item.type.includes('creature') && !item.type.includes('instant') && !item.type.includes('sorcery'),
        )
        .slice(0, 24)
        .map((item) => item.oracle),
    };

    if (!cardHistory.history) {
      cardHistory.history = [];
    }

    cardHistory.history.push({
      date: currentDate,
      data: currentDatapoint,
    });

    await cardHistory.save();
  } catch (error) {
    winston.error(error, { error });
  }
}

const run = async () => {
  const d = new Date();
  currentDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  cardUses = {};
  ratingsDict = {};

  cardSizeUses = {
    size180: {},
    size360: {},
    size450: {},
    size540: {},
    size720: {},
    pauper: {},
    peasant: {},
    legacy: {},
    modern: {},
    standard: {},
    vintage: {},
  };

  cubeCounts = {
    total: 0,
    size180: 0,
    size360: 0,
    size450: 0,
    size540: 0,
    size720: 0,
    pauper: 0,
    peasant: 0,
    legacy: 0,
    modern: 0,
    standard: 0,
    vintage: 0,
  };

  correlationIndex = {};
  correlations = [];
  synergies = [];

  // use correlationIndex for index
  cubesWithCard = [];

  winston.info('Starting card db');

  await carddb.initializeCardDb();

  winston.info('finished loading cards');

  const ratings = await CardRating.find({}).lean();

  winston.info('Started: oracles');

  distinctOracles = [...new Set(carddb.allOracleIds())];
  const distinctNames = [...new Set(distinctOracles.map((oracle) => cardFromOracle(oracle).name_lower))];
  distinctOracles = [
    ...new Set(
      distinctNames.map((name) => carddb.cardFromId(carddb.nameToId[name][0]).oracle_id).filter((oracle) => oracle),
    ),
  ];

  winston.info('creating correlation matrix...');
  createCorrelations();
  winston.info('creating synergy matrix...');
  createSynergyMatrix();

  for (const rating of ratings) {
    ratingsDict[rating.name] = rating;
  }

  // process all cube objects
  winston.info('Started: cubes');
  let count = await Cube.countDocuments();
  let cursor = Cube.find().lean().cursor();
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await processCube(await cursor.next());
    if ((i + 1) % 10 === 0) {
      winston.info(`Finished: ${i + 1} of ${count} cubes.`);
    }

    break;
  }
  winston.info('Finished: all cubes');

  // process all deck objects
  winston.info('Started: decks');
  count = await Deck.countDocuments();
  cursor = Deck.find().lean().cursor();
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await processDeck(await cursor.next());
    if ((i + 1) % 1000 === 0) {
      winston.info(`Finished: ${i + 1} of ${count} decks.`);
    }
    break;
  }
  winston.info('Finished: all decks');

  // save card models
  const allOracleIds = carddb.allOracleIds();
  const totalCards = allOracleIds.length;
  let processed = 0;
  for (const oracleId of allOracleIds) {
    const card = cardFromOracle(oracleId);
    await processCard(card); // eslint-disable-line no-await-in-loop
    processed += 1;
    winston.info(`Finished ${oracleId}: ${processed} of ${totalCards} cards.`);
  }

  winston.info('Done');
  // this is needed for log group to stream
  await new Promise((resolve) => {
    setTimeout(resolve, 10000);
  });
  process.exit();
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    await run();
  } catch (error) {
    winston.error(error, { error });
  }

  process.exit();
})();
