/* eslint-disable no-restricted-globals */
/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const { winston } = require('../serverjs/cloudwatch');
const carddb = require('../serverjs/cards');
const Deck = require('../dynamo/models/draft');
const Cube = require('../dynamo/models/cube');
const CardHistory = require('../dynamo/models/cardHistory');
const CardRating = require('../dynamo/models/cardMetadata');

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];
const RELATED_LIMIT = 24;
let ORACLE_COUNT = 0;

const cardFromOracle = (oracle) => carddb.cardFromId(carddb.getVersionsByOracleId(oracle)[0]);

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

  currentDatapoint.cubes = currentDatapoint.total[0];

  currentDatapoint.prices = versions.map((id) => {
    const versionPrice = { version: id };
    const { prices } = carddb.cardFromId(id);
    if (prices) {
      versionPrice.price = prices.usd;
      versionPrice.price_foil = prices.usd_foil;
      versionPrice.price_etched = prices.usd_etched;
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

  winston.info('Started: oracles');

  const distinctOracles = carddb.allOracleIds();
  ORACLE_COUNT = distinctOracles.length;

  winston.info(`Created list of ${ORACLE_COUNT} oracles`);

  const oracleToIndex = Object.fromEntries(distinctOracles.map((item, index) => [item, index]));

  winston.info('creating correlation matrices...');

  const cubedWith = new Int32Array(ORACLE_COUNT * ORACLE_COUNT).fill(0);
  const draftedWith = new Int32Array(ORACLE_COUNT * ORACLE_COUNT).fill(0);

  // process all cube objects
  winston.info('Started: cubes');
  const cubes = [];
  let lastKey;
  do {
    const scan = await Cube.scan(lastKey, ['id']);
    cubes.push(...scan.items.map((item) => item.id));
    lastKey = scan.lastKey;
  } while (lastKey);
};
winston.info('Loaded all cube ids');

(async () => {
  await run();
  process.exit();
})();
