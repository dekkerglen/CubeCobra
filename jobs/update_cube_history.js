/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/cards');

const ChangeLog = require('../dynamo/models/changelog');
const CardHistory = require('../dynamo/models/cardHistory');
const { getCubeTypes } = require('../serverjs/cubefn');

let checkpoint = 727;

(async () => {
  await carddb.initializeCardDb();

  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
  }
  // create global_draft_history and cube_draft_history folders
  if (!fs.existsSync('./temp/cubes_history')) {
    fs.mkdirSync('./temp/cubes_history');
  }

  let logsByDay = {};
  let keys = [];
  if (checkpoint < 1) {
    // load all changelogs into memory
    let lastKey = null;
    let changelogs = [];
    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await ChangeLog.scan(1000000, lastKey);
      changelogs = changelogs.concat(result.items);
      lastKey = result.lastKey;

      console.log(`Loaded ${changelogs.length} changelogs`);
    } while (lastKey);

    console.log('Loaded all changelogs');

    for (const log of changelogs) {
      const date = new Date(log.date);
      const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDate()];

      const key = new Date(year, month, day).valueOf();

      if (!keys.includes(key)) {
        keys.push(key);
        logsByDay[key] = [];
      }

      logsByDay[key].push(log);
    }

    console.log('Buckets created');

    // sort the keys ascending
    keys.sort((a, b) => a - b);

    // save the files
    fs.writeFileSync('temp/logsByDay.json', JSON.stringify({ logsByDay, keys }));
    checkpoint += 1;
  } else {
    // load the files
    const loaded = JSON.parse(fs.readFileSync('temp/logsByDay.json'));
    logsByDay = loaded.logsByDay;
    keys = loaded.keys;
  }

  console.log(`Loaded ${keys.length} days of logs`);

  const cubes = {};

  if (checkpoint >= 2) {
    // load the cubes
    const loaded = JSON.parse(fs.readFileSync(`temp/cubes_history/${keys[checkpoint - 2]}.json`));
    Object.assign(cubes, loaded);
  }

  for (let i = checkpoint - 1; i < keys.length; i++) {
    const logRows = logsByDay[keys[i]];
    const logs = await ChangeLog.batchGet(logRows);

    for (let j = 0; j < logs.length; j++) {
      const log = logs[j];
      const logRow = logRows[j];

      if (!cubes[logRow.cube]) {
        cubes[logRow.cube] = [];
      }

      if (log.Mainboard.adds) {
        for (const add of log.Mainboard.adds) {
          cubes[logRow.cube].push(add.cardID);
        }
      }

      if (log.Mainboard.removes) {
        for (const remove of log.Mainboard.removes) {
          cubes[logRow.cube].splice(cubes[logRow.cube].indexOf(remove.oldCard.cardID), 1);
        }
      }

      if (log.Mainboard.swaps) {
        for (const swap of log.Mainboard.swaps) {
          cubes[logRow.cube].splice(cubes[logRow.cube].indexOf(swap.oldCard.cardID), 1, swap.card.cardID);
        }
      }
    }

    fs.writeFileSync(`temp/cubes_history/${keys[i]}.json`, JSON.stringify(cubes));

    //    console.log(`Processing ${logs.length} logs for day ${i + 1} of ${keys.length}`);
    console.log(
      `Finished checkpoint ${checkpoint} / ${keys.length + 1}: Processed ${logRows.length} logs for ${new Date(
        keys[i],
      )}`,
    );
    checkpoint += 1;
  }

  const start = 1 + keys.length;
  const end = start + keys.length;

  for (let i = checkpoint; i < end; i++) {
    const key = keys[i - start];
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

    const cubeList = JSON.parse(fs.readFileSync(`temp/cubes_history/${key}.json`));

    for (const cube of Object.values(cubeList)) {
      const cubeCards = cube.map((id) => carddb.cardFromId(id));
      const oracles = [...new Set(cubeCards.map((card) => card.oracle_id))];
      const { pauper, peasant, type } = getCubeTypes(
        cubeCards.map((card) => ({ cardID: card._id })),
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

    await CardHistory.batchPut(
      Object.entries(data).map(([oracle, history]) => ({
        [CardHistory.FIELDS.ORACLE_TYPE_COMP]: `${oracle}:${CardHistory.TYPES.DAY}`,
        [CardHistory.FIELDS.ORACLE_ID]: oracle,
        [CardHistory.FIELDS.DATE]: key,
        [CardHistory.FIELDS.ELO]: 1200,
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
      })),
    );

    // if key is a sunday
    if (new Date(key).getDay() === 0) {
      await CardHistory.batchPut(
        Object.entries(data).map(([oracle, history]) => ({
          [CardHistory.FIELDS.ORACLE_TYPE_COMP]: `${oracle}:${CardHistory.TYPES.WEEK}`,
          [CardHistory.FIELDS.ORACLE_ID]: oracle,
          [CardHistory.FIELDS.DATE]: key,
          [CardHistory.FIELDS.ELO]: 1200,
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
        })),
      );
    }

    // if key is first of the month
    if (new Date(key).getDate() === 1) {
      await CardHistory.batchPut(
        Object.entries(data).map(([oracle, history]) => ({
          [CardHistory.FIELDS.ORACLE_TYPE_COMP]: `${oracle}:${CardHistory.TYPES.MONTH}`,
          [CardHistory.FIELDS.ORACLE_ID]: oracle,
          [CardHistory.FIELDS.DATE]: key,
          [CardHistory.FIELDS.ELO]: 1200,
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
        })),
      );
    }

    console.log(`Pushed history for ${i - start + 1}/${keys.length}, done with checkpoint ${checkpoint} / ${end}`);

    checkpoint += 1;
  }

  process.exit();
})();
