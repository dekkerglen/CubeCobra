// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const fs = require('fs');
const carddb = require('../serverjs/cards');

const changelog = require('../dynamo/models/changelog');

let checkpoint = 661;

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();

  let logsByDay = {};
  let keys = [];
  if (checkpoint < 1) {
    // load all changelogs into memory
    let lastKey = null;
    let changelogs = [];
    do {
      const result = await changelog.scan(1000000, lastKey);
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
    const loaded = JSON.parse(fs.readFileSync(`temp/cubes_${keys[checkpoint - 2]}.json`));
    Object.assign(cubes, loaded);
  }

  for (let i = checkpoint - 1; i < keys.length; i++) {
    const logRows = logsByDay[keys[i]];
    const logs = await changelog.batchGet(logRows);

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

    fs.writeFileSync(`temp/cubes_${keys[i]}.json`, JSON.stringify(cubes));

    //    console.log(`Processing ${logs.length} logs for day ${i + 1} of ${keys.length}`);
    console.log(
      `Finished checkpoint ${checkpoint} / ${keys.length + 1}: Processed ${logRows.length} logs for ${new Date(
        keys[i],
      )}`,
    );
    checkpoint += 1;
  }

  process.exit();
})();
