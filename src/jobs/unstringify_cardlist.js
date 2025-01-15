// Load Environment Variables
require('dotenv').config();
const fs = require('fs');
const Draft = require('../dynamo/models/draft');
const { getObject, putObject } = require('../dynamo/s3client');

const unstringify = async (draftLog) => {
  const cards = getObject(process.env.DATA_BUCKET, `cardlist/${draftLog.id}.json`);

  // if it's a string
  if (typeof cards === 'string') {
    const unstringified = JSON.parse(cards);
    await putObject(process.env.DATA_BUCKET, `cardlist/${draftLog.id}.json`, unstringified);
  }
};

const skip = 0;

(async () => {
  let ids = [];

  if (fs.existsSync('./temp/unstringifyCardlist.js')) {
    ids = JSON.parse(fs.readFileSync('./temp/unstringifyCardlist.js'));
  } else {
    // load all draftlogs into memory
    let lastKey = null;
    let draftLogs = [];
    do {
      const result = await Draft.scan(1000000, lastKey);
      draftLogs = draftLogs.concat(result.items);
      lastKey = result.lastKey;

      console.log(`Loaded ${draftLogs.length} draftlogs`);
    } while (lastKey);

    ids = draftLogs.map((d) => d.id);
  }

  console.log('Loaded all draftlogs');
  fs.writeFileSync('./temp/unstringifyCardlist.js', JSON.stringify(ids));

  const batches = [];
  for (let i = 0; i < ids.length; i += 10) {
    batches.push(ids.slice(i, i + 10));
  }

  for (let i = skip; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1} of ${batches.length}`);
    await Promise.all(batch.map((draftLog) => unstringify(draftLog)));
  }

  process.exit();
})();
