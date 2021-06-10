/* eslint-disable no-restricted-globals */
/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const { winston } = require('../serverjs/cloudwatch');
const carddb = require('../serverjs/cards.js');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const CardHistory = require('../models/cardHistory');
const CardRating = require('../models/cardrating');
const { fromEntries } = require('../serverjs/util');

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];
const RELATED_LIMIT = 24;
let ORACLE_COUNT = 0;

const cardFromOracle = (oracle) => carddb.cardFromId(carddb.getVersionsByOracleId(oracle)[0]);

const getSynergy = (oracle1, oracle2) => {
  const em1 = cardFromOracle(oracle1).embedding;
  const em2 = cardFromOracle(oracle2).embedding;
  if (oracle1 === oracle2) {
    return 1;
  }

  let sim = 0;
  if (em1 && em2 && em1.length === em2.length) {
    for (let i = 0; i < 64; i++) {
      sim += em1[i] * em2[i];
    }
  }
  return sim;
};

const createSynergyMatrix = (distinctOracles) => {
  const synergies = new Float32Array(ORACLE_COUNT * ORACLE_COUNT).fill(0);

  for (let i = 0; i < ORACLE_COUNT; i += 1) {
    for (let j = 0; j < ORACLE_COUNT; j += 1) {
      synergies[i * ORACLE_COUNT + j] = getSynergy(distinctOracles[i], distinctOracles[j]);
      synergies[j * ORACLE_COUNT + i] = getSynergy(distinctOracles[i], distinctOracles[j]);
    }
    if ((i + 1) % 100 === 0) {
      winston.info(`Finished: ${i + 1} of ${ORACLE_COUNT} synergies.`);
    }
  }

  return synergies;
};

const accessMatrix = (matrix, oracle, otherOracle, oracleToIndex) =>
  matrix[oracleToIndex[oracle] * ORACLE_COUNT + oracleToIndex[otherOracle]];

const incrementMatrix = (matrix, oracle, otherOracle, oracleToIndex) => {
  matrix[oracleToIndex[oracle] * ORACLE_COUNT + oracleToIndex[otherOracle]] += 1;
};

const attemptIncrement = (obj, propname) => {
  if (!obj[propname]) {
    obj[propname] = 0;
  }
  obj[propname] += 1;
};

const processDeck = async (deck, oracleToIndex, correlations) => {
  const { cards } = deck;
  if (deck.seats && deck.seats[0] && deck.seats[0].deck && deck.seats[0].deck.length > 0) {
    // flatten array
    const deckCards = [];
    deck.seats[0].deck.forEach((row) =>
      row.forEach((col) => {
        if(col) {
          col.forEach((ci) => {
            if ((ci || ci === 0) && cards[ci] && cards[ci].cardID) {
              deckCards.push(carddb.cardFromId(cards[ci].cardID).oracle_id);
            }
          });
        }
      }),
    );

    for (let i = 0; i < deckCards.length; i += 1) {
      // could be an invalid card
      if (oracleToIndex[deckCards[i]] && !basics.includes(deckCards[i])) {
        for (let j = i + 1; j < deckCards.length; j += 1) {
          if (!basics.includes(deckCards[j])) {
            try {
              incrementMatrix(correlations, deckCards[j], deckCards[i], oracleToIndex);
              incrementMatrix(correlations, deckCards[i], deckCards[j], oracleToIndex);
            } catch (err) {
              winston.info(`${deckCards[i]} or ${deckCards[j]} cannot be indexed.`);
            }
          }
        }
      }
    }
  }
};

const processCube = async (cube, cardUseCount, cardCountByCubeSize, cubeCountBySize, oracleToIndex) => {
  let cubeSizeDict = cardCountByCubeSize.size180;
  let cubeLegalityDict = cardCountByCubeSize.vintage;

  cubeCountBySize.total += 1;
  if (cube.card_count <= 180) {
    cubeSizeDict = cardCountByCubeSize.size180;
    cubeCountBySize.size180 += 1;
  } else if (cube.card_count <= 360) {
    cubeSizeDict = cardCountByCubeSize.size360;
    cubeCountBySize.size360 += 1;
  } else if (cube.card_count <= 450) {
    cubeSizeDict = cardCountByCubeSize.size450;
    cubeCountBySize.size450 += 1;
  } else if (cube.card_count <= 540) {
    cubeSizeDict = cardCountByCubeSize.size540;
    cubeCountBySize.size540 += 1;
  } else {
    cubeSizeDict = cardCountByCubeSize.size720;
    cubeCountBySize.size720 += 1;
  }

  let isPauper = false;
  let isPeasant = false;
  if (cube.type) {
    if (
      cube.type.toLowerCase().includes('standard') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Standard'))
    ) {
      cubeLegalityDict = cardCountByCubeSize.standard;
      cubeCountBySize.standard += 1;
    } else if (
      cube.type.toLowerCase().includes('modern') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Modern'))
    ) {
      cubeLegalityDict = cardCountByCubeSize.modern;
      cubeCountBySize.modern += 1;
    } else if (
      cube.type.toLowerCase().includes('legacy') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Legacy'))
    ) {
      cubeLegalityDict = cardCountByCubeSize.legacy;
      cubeCountBySize.legacy += 1;
    } else if (
      cube.type.toLowerCase().includes('vintage') ||
      (cube.overrideCategory && cube.categoryOverride.includes('Vintage'))
    ) {
      cubeLegalityDict = cardCountByCubeSize.vintage;
      cubeCountBySize.vintage += 1;
    }

    if (
      cube.type.toLowerCase().includes('pauper') ||
      (cube.overrideCategory && cube.categoryPrefixes.includes('Pauper'))
    ) {
      cubeCountBySize.pauper += 1;
      isPauper = true;
    }

    if (
      cube.type.toLowerCase().includes('peasant') ||
      (cube.overrideCategory && cube.categoryPrefixes.includes('Peasant'))
    ) {
      cubeCountBySize.peasant += 1;
      isPeasant = true;
    }
  }

  const uniqueOracleIds = Array.from(
    new Set(cube.cards.filter((c) => c).map((card) => carddb.cardFromId(card.cardID).oracle_id)),
  );
  uniqueOracleIds.forEach((oracleId) => {
    // total
    attemptIncrement(cardUseCount, oracleId);

    // card counts collated by cube sizes
    attemptIncrement(cubeSizeDict, oracleId);

    // card counts collated by cube type
    attemptIncrement(cubeLegalityDict, oracleId);
    if (isPauper) {
      attemptIncrement(cardCountByCubeSize.pauper, oracleId);
    }
    if (isPeasant) {
      attemptIncrement(cardCountByCubeSize.peasant, oracleId);
    }
  });
};

// negative if otherOracle has greater value than otherOracle2
// to sort descending
const compareOracles = (oracle, otherOracle, otherOracle2, matrix, oracleToIndex) =>
  accessMatrix(matrix, oracle, otherOracle2, oracleToIndex) - accessMatrix(matrix, oracle, otherOracle, oracleToIndex);

const getIndex = (array, oracle, otherOracle, table, oracleToIndex) => {
  let start = 0;
  let end = array.length - 1;
  let mid = -1;

  while (start <= end) {
    mid = Math.floor((start + end) / 2);

    if (compareOracles(oracle, otherOracle, array[mid], table, oracleToIndex) === 0) {
      return mid;
    }

    if (compareOracles(oracle, otherOracle, array[mid], table, oracleToIndex) > 0) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  if (compareOracles(oracle, otherOracle, array[mid], table, oracleToIndex) > 0) {
    return mid + 1;
  }
  return mid;
};

// Assumes array has already been sorted with this sort function
// RELATED_LIMIT is the max size we can make use of
const insertSorted = (array, oracle, otherOracle, table, oracleToIndex) => {
  if (array.length === 0) {
    return [oracle];
  }

  if (compareOracles(oracle, otherOracle, array[0], table, oracleToIndex) < 0) {
    // item should be in front of existing array
    array.splice(0, 0, otherOracle);
  } else if (
    compareOracles(oracle, otherOracle, array[array.length - 1], table, oracleToIndex) > 0 &&
    array.length < RELATED_LIMIT
  ) {
    // item should be at end of existing array, and we are under our limit
    array.splice(array.length, 0, otherOracle);
  } else {
    // item should be inserted somewhere into the array
    const index = getIndex(array, oracle, otherOracle, table, oracleToIndex);
    array.splice(index, 0, otherOracle);
  }

  // truncate our array to our limit
  if (array.length > RELATED_LIMIT) {
    array.splice(RELATED_LIMIT, array.length - RELATED_LIMIT);
  }

  return array;
};

const processCard = async (
  card,
  cardUseCount,
  rating,
  currentDate,
  distinctOracles,
  cardCountByCubeSize,
  cubeCountBySize,
  oracleToIndex,
  correlations,
  synergies,
) => {
  const versions = carddb.getVersionsByOracleId(card.oracle_id);

  const currentDatapoint = {};

  currentDatapoint.rating = rating ? rating.rating : null;
  currentDatapoint.elo = rating ? rating.elo : null;
  currentDatapoint.picks = rating ? rating.picks : 0;

  currentDatapoint.total = cardUseCount[card.oracle_id]
    ? [cardUseCount[card.oracle_id], cardUseCount[card.oracle_id] / cubeCountBySize.total]
    : [0, 0];
  for (const cubeCategory of Object.keys(cardCountByCubeSize)) {
    currentDatapoint[cubeCategory] = cardCountByCubeSize[cubeCategory][card.oracle_id]
      ? [
          cardCountByCubeSize[cubeCategory][card.oracle_id],
          cardCountByCubeSize[cubeCategory][card.oracle_id] / cubeCountBySize[cubeCategory],
        ]
      : [0, 0];
  }

  const cubes = cardUseCount[card.oracle_id];

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
  const cubedWith = {
    synergistic: [],
    top: [],
    creatures: [],
    spells: [],
    other: [],
  };

  for (const otherOracleId of distinctOracles) {
    const type = cardFromOracle(otherOracleId).type.toLowerCase();

    if (otherOracleId !== card.oracle_id && !type.includes('basic')) {
      cubedWith.synergistic = insertSorted(
        cubedWith.synergistic,
        card.oracle_id,
        otherOracleId,
        synergies,
        oracleToIndex,
      );
      cubedWith.top = insertSorted(cubedWith.top, card.oracle_id, otherOracleId, correlations, oracleToIndex);
    }

    if (otherOracleId !== card.oracle_id && type.includes('creature')) {
      cubedWith.creatures = insertSorted(
        cubedWith.creatures,
        card.oracle_id,
        otherOracleId,
        correlations,
        oracleToIndex,
      );
    } else if (otherOracleId !== card.oracle_id && (type.includes('instant') || type.includes('sorcery'))) {
      cubedWith.spells = insertSorted(cubedWith.spells, card.oracle_id, otherOracleId, correlations, oracleToIndex);
    } else if (otherOracleId !== card.oracle_id && !type.includes('basic')) {
      cubedWith.other = insertSorted(cubedWith.other, card.oracle_id, otherOracleId, correlations, oracleToIndex);
    }
  }

  const cardHistory = (await CardHistory.findOne({ oracleId: card.oracle_id })) || new CardHistory();

  if (cardHistory.isNew) {
    cardHistory.cardName = card.name;
    cardHistory.oracleId = card.oracle_id;
    cardHistory.versions = versions;
    cardHistory.history = [];
  }

  cardHistory.current = currentDatapoint;

  cardHistory.cubedWith = cubedWith;

  cardHistory.history.push({
    date: currentDate,
    data: currentDatapoint,
  });

  await cardHistory.save();
};

const run = async () => {
  const d = new Date();
  const currentDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  const cardUseCount = {};
  const ratingsDict = {};

  const cardCountByCubeSize = {
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

  const cubeCountBySize = {
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

  winston.info('Starting card db');

  await carddb.initializeCardDb();

  winston.info('finished loading cards');

  const ratings = await CardRating.find({}).lean();

  winston.info('Started: oracles');

  const distinctOracles = carddb.allOracleIds();
  ORACLE_COUNT = distinctOracles.length;

  console.log(distinctOracles[0]);

  winston.info(`Created list of ${ORACLE_COUNT} oracles`);

  const oracleToIndex = fromEntries(distinctOracles.map((item, index) => [item, index]));

  winston.info('creating correlation matrix...');

  const correlations = new Int32Array(ORACLE_COUNT * ORACLE_COUNT).fill(0);

  winston.info('creating synergy matrix...');
  const synergies = createSynergyMatrix(distinctOracles);

  for (const item of ratings) {
    ratingsDict[item.name] = item;
  }

  // process all cube objects
  winston.info('Started: cubes');
  let count = await Cube.countDocuments();
  let cursor = Cube.find({}, 'card_count overrideCategory categoryOverride categoryPrefixes type cards')
    .lean()
    .cursor();
  for (let i = 0; i < count; i += 1) {
    await processCube(await cursor.next(), cardUseCount, cardCountByCubeSize, cubeCountBySize, oracleToIndex);
    if ((i + 1) % 100 === 0) {
      winston.info(`Finished: ${i + 1} of ${count} cubes.`);
    }
  }
  cursor.close();
  winston.info('Finished: all cubes');

  // process all deck objects
  winston.info('Started: decks');
  count = await Deck.count();
  cursor = Deck.find({}, 'seats cards').lean().cursor();
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await processDeck(await cursor.next(), oracleToIndex, correlations);
    if ((i + 1) % 1000 === 0) {
      winston.info(`Finished: ${i + 1} of ${count} decks.`);
    }
  }
  cursor.close();
  winston.info('Finished: all decks');

  // save card models
  const allOracleIds = carddb.allOracleIds();
  let processed = 0;

  for (const oracleId of allOracleIds) {
    const card = cardFromOracle(oracleId);
    await processCard(
      card,
      cardUseCount,
      ratingsDict[card.name],
      currentDate,
      distinctOracles,
      cardCountByCubeSize,
      cubeCountBySize,
      oracleToIndex,
      correlations,
      synergies,
    );
    processed += 1;
    if (processed % 100 === 0) {
      winston.info(`Finished ${processed} of ${ORACLE_COUNT} cards.`);
    }
  }

  winston.info('Done');

  // this is needed for log group to stream
  await new Promise((resolve) => {
    setTimeout(resolve, 10000);
  });
  process.exit();
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await run();
  process.exit();
})();
