// Load Environment Variables
require('dotenv').config();

const fs = require('fs');
const carddb = require('../util/carddb');

const ChangeLog = require('../dynamo/models/changelog');
const CardHistory = require('../dynamo/models/cardhistory');
const { getCubeTypes } = require('../util/cubefn');

const saveCubesHistory = async (cubes, key) => {
  const uniqueOracles = [...new Set(Object.values(cubes).flat())];

  const oracleToIndexMap = Object.fromEntries(uniqueOracles.map((oracle, index) => [oracle, index]));
  const indexToOracleMap = Object.fromEntries(uniqueOracles.map((oracle, index) => [index, oracle]));

  const cubeHistory = {
    cubes: {},
    indexToOracleMap,
  };

  for (const [cubeId, cube] of Object.entries(cubes)) {
    cubeHistory.cubes[cubeId] = cube.map((card) => oracleToIndexMap[card]);
  }

  fs.writeFileSync(`temp/cubes_history/${key}.json`, JSON.stringify(cubeHistory));
};

const loadCubesHistory = async (key) => {
  const data = JSON.parse(fs.readFileSync(`temp/cubes_history/${key}.json`));

  if (data.cubes) {
    const cubes = {};
    for (const [cubeId, cube] of Object.entries(data.cubes)) {
      cubes[cubeId] = cube.map((index) => data.indexToOracleMap[index]);
    }

    return cubes;
  }

  return data;
};

(async () => {
  await carddb.initializeCardDb();

  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
  }
  // create global_draft_history and cube_draft_history folders
  if (!fs.existsSync('./temp/cubes_history')) {
    fs.mkdirSync('./temp/cubes_history');
  }

  const logsByDay = {};
  const keys = [];

  // load all changelogs into memory
  let lastKey = null;
  let changelogs = [];
  do {
    const result = await ChangeLog.scan(1000000, lastKey);
    changelogs = changelogs.concat(result.items);
    lastKey = result.lastKey;

    console.log(`Loaded ${changelogs.length} changelogs`);
  } while (lastKey);

  console.log('Loaded all changelogs');
  let firstDate = null;

  for (const log of changelogs) {
    const date = new Date(log.date);
    const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDate()];

    const key = `${year}-${month}-${day}`;

    if (!logsByDay[key]) {
      logsByDay[key] = [];
      keys.push(key);
    }

    if (!firstDate || date < firstDate) {
      firstDate = date;
    }

    logsByDay[key].push(log);
  }

  const today = new Date().valueOf();

  for (let i = firstDate.valueOf(); i <= today; i += 86400000) {
    const date = new Date(i);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (!logsByDay[key]) {
      logsByDay[key] = [];
      keys.push(key);
    }
  }

  console.log('Buckets created');

  // sort the keys ascending
  keys.sort((a, b) => {
    const [yearA, monthA, dayA] = a.split('-');
    const [yearB, monthB, dayB] = b.split('-');

    if (yearA !== yearB) {
      return yearA - yearB;
    }

    if (monthA !== monthB) {
      return monthA - monthB;
    }

    return dayA - dayB;
  });

  console.log(`Loaded ${keys.length} days of logs`);

  let cubes = {};
  let oracleToElo = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (fs.existsSync(`./temp/cubes_history/${key}.json`)) {
      console.log(`Already finished ${i} / ${keys.length}: for ${key}`);

      if (i < keys.length - 1 && !fs.existsSync(`./temp/cubes_history/${keys[i + 1]}.json`)) {
        cubes = await loadCubesHistory(key);
      }
    } else {
      const logRows = logsByDay[key] || [];
      const logs = await ChangeLog.batchGet(logRows);

      for (let j = 0; j < logs.length; j++) {
        const log = logs[j];
        const logRow = logRows[j];

        if (!cubes[logRow.cube]) {
          cubes[logRow.cube] = [];
        }

        if (log.mainboard && log.mainboard.adds) {
          for (const add of log.mainboard.adds) {
            cubes[logRow.cube].push(add.cardID);
          }
        }

        if (log.mainboard && log.mainboard.removes) {
          for (const remove of log.mainboard.removes) {
            cubes[logRow.cube].splice(cubes[logRow.cube].indexOf(remove.oldCard.cardID), 1);
          }
        }

        if (log.mainboard && log.mainboard.swaps) {
          for (const swap of log.mainboard.swaps) {
            cubes[logRow.cube].splice(cubes[logRow.cube].indexOf(swap.oldCard.cardID), 1, swap.card.cardID);
          }
        }
      }

      await saveCubesHistory(cubes, key);

      const totals = {
        size180: 0,
        size360: 0,
        size450: 0,
        size540: 0,
        size720: 0,
        pauper: 0,
        peasant: 0,
        legacy: 0,
        modern: 0,
        vintage: 0,
        total: 0,
      };

      const data = {};

      for (const cube of Object.values(cubes)) {
        const cubeCards = cube.map((id) => carddb.cardFromId(id));
        const oracles = [...new Set(cubeCards.map((card) => card.oracle_id))];
        const { pauper, peasant, type } = getCubeTypes(
          cubeCards.map((card) => ({ cardID: card.scryfall_id })),
          carddb,
        );

        const size = cube.length;

        const categories = ['total'];

        if (size <= 180) {
          categories.push('size180');
        } else if (size <= 360) {
          categories.push('size360');
        } else if (size <= 450) {
          categories.push('size450');
        } else if (size <= 540) {
          categories.push('size540');
        } else {
          categories.push('size720');
        }

        if (pauper) {
          categories.push('pauper');
        }

        if (peasant) {
          categories.push('peasant');
        }

        switch (type) {
          case 0: // vintage
            categories.push('vintage');
            break;
          case 1: // legacy
            categories.push('legacy');
            break;
          case 2: // modern
            categories.push('modern');
            break;
          case 4: // pioneer
            categories.push('pioneer');
            break;
          default:
            break;
        }

        for (const category of categories) {
          totals[category] += 1;
        }

        for (const oracle of oracles) {
          if (!data[oracle]) {
            data[oracle] = {
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
              vintage: 0,
            };
          }

          for (const category of categories) {
            data[oracle][category] += 1;
          }
        }
      }

      if (fs.existsSync(`temp/global_draft_history/${key}.json`)) {
        const eloFile = fs.readFileSync(`temp/global_draft_history/${key}.json`);
        oracleToElo = JSON.parse(eloFile).eloByOracleId;
      }

      const [year, month, day] = key.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10), parseInt(day, 10)).valueOf();

      await CardHistory.batchPut(
        Object.entries(data).map(([oracle, history]) => ({
          [CardHistory.FIELDS.ORACLE_TYPE_COMP]: `${oracle}:${CardHistory.TYPES.DAY}`,
          [CardHistory.FIELDS.ORACLE_ID]: oracle,
          [CardHistory.FIELDS.DATE]: date,
          [CardHistory.FIELDS.PICKS]: 0,
          [CardHistory.FIELDS.SIZE180]: [history.size180, totals.size180],
          [CardHistory.FIELDS.SIZE360]: [history.size360, totals.size360],
          [CardHistory.FIELDS.SIZE450]: [history.size450, totals.size450],
          [CardHistory.FIELDS.SIZE540]: [history.size540, totals.size540],
          [CardHistory.FIELDS.SIZE720]: [history.size720, totals.size720],
          [CardHistory.FIELDS.PAUPER]: [history.pauper, totals.pauper],
          [CardHistory.FIELDS.PEASANT]: [history.peasant, totals.peasant],
          [CardHistory.FIELDS.LEGACY]: [history.legacy, totals.legacy],
          [CardHistory.FIELDS.MODERN]: [history.modern, totals.modern],
          [CardHistory.FIELDS.VINTAGE]: [history.vintage, totals.vintage],
          [CardHistory.FIELDS.TOTAL]: [history.total, totals.total],
          [CardHistory.FIELDS.ELO]: oracleToElo[oracle],
        })),
      );

      // if key is a sunday
      if (new Date(key).getDay() === 0) {
        await CardHistory.batchPut(
          Object.entries(data).map(([oracle, history]) => ({
            [CardHistory.FIELDS.ORACLE_TYPE_COMP]: `${oracle}:${CardHistory.TYPES.WEEK}`,
            [CardHistory.FIELDS.ORACLE_ID]: oracle,
            [CardHistory.FIELDS.DATE]: date,
            [CardHistory.FIELDS.PICKS]: 0,
            [CardHistory.FIELDS.SIZE180]: [history.size180, totals.size180],
            [CardHistory.FIELDS.SIZE360]: [history.size360, totals.size360],
            [CardHistory.FIELDS.SIZE450]: [history.size450, totals.size450],
            [CardHistory.FIELDS.SIZE540]: [history.size540, totals.size540],
            [CardHistory.FIELDS.SIZE720]: [history.size720, totals.size720],
            [CardHistory.FIELDS.PAUPER]: [history.pauper, totals.pauper],
            [CardHistory.FIELDS.PEASANT]: [history.peasant, totals.peasant],
            [CardHistory.FIELDS.LEGACY]: [history.legacy, totals.legacy],
            [CardHistory.FIELDS.MODERN]: [history.modern, totals.modern],
            [CardHistory.FIELDS.VINTAGE]: [history.vintage, totals.vintage],
            [CardHistory.FIELDS.TOTAL]: [history.total, totals.total],
            [CardHistory.FIELDS.ELO]: oracleToElo[oracle],
          })),
        );
      }

      // if key is first of the month
      if (new Date(key).getDate() === 1) {
        await CardHistory.batchPut(
          Object.entries(data).map(([oracle, history]) => ({
            [CardHistory.FIELDS.ORACLE_TYPE_COMP]: `${oracle}:${CardHistory.TYPES.MONTH}`,
            [CardHistory.FIELDS.ORACLE_ID]: oracle,
            [CardHistory.FIELDS.DATE]: date,
            [CardHistory.FIELDS.PICKS]: 0,
            [CardHistory.FIELDS.SIZE180]: [history.size180, totals.size180],
            [CardHistory.FIELDS.SIZE360]: [history.size360, totals.size360],
            [CardHistory.FIELDS.SIZE450]: [history.size450, totals.size450],
            [CardHistory.FIELDS.SIZE540]: [history.size540, totals.size540],
            [CardHistory.FIELDS.SIZE720]: [history.size720, totals.size720],
            [CardHistory.FIELDS.PAUPER]: [history.pauper, totals.pauper],
            [CardHistory.FIELDS.PEASANT]: [history.peasant, totals.peasant],
            [CardHistory.FIELDS.LEGACY]: [history.legacy, totals.legacy],
            [CardHistory.FIELDS.MODERN]: [history.modern, totals.modern],
            [CardHistory.FIELDS.VINTAGE]: [history.vintage, totals.vintage],
            [CardHistory.FIELDS.TOTAL]: [history.total, totals.total],
            [CardHistory.FIELDS.ELO]: oracleToElo[oracle],
          })),
        );
      }

      console.log(`Finished  ${i} / ${keys.length}: Processed ${logRows.length} logs for ${key}`);
    }
  }

  console.log('Complete');

  process.exit();
})();
