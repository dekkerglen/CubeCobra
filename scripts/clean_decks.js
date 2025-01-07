const Draft = require('../dynamo/models/draft');

(async () => {
  let lastKey = null;
  let draftLogs = [];
  do {
    const result = await Draft.scan(1000000, lastKey);
    draftLogs = draftLogs.concat(result.items);
    lastKey = result.lastKey;

    console.log(`Loaded ${draftLogs.length} draftlogs`);
  } while (lastKey);

  console.log('Loaded all draftlogs');

  const logRowBatches = [];
  const batchSize = 100;
  for (let j = 0; j < draftLogs.length; j += batchSize) {
    logRowBatches.push(draftLogs.slice(j, j + batchSize));
  }

  let index = 0;
  for (const batch of logRowBatches) {
    const drafts = await Draft.batchGet(batch.map((row) => row.id));

    const toUpdate = [];

    for (const draft of drafts) {
      if (draft.seats[0].Mainboard) {
        draft.seats = draft.seats.map((seat) => {
          const res = {
            ...seat,
            mainboard: seat.Mainboard,
          };
          delete res.Mainboard;
          return res;
        });
        toUpdate.push(draft);
      }

      if (draft.seats[0].drafted) {
        draft.seats = draft.seats.map((seat) => {
          const res = {
            ...seat,
            mainboard: seat.drafted,
          };
          delete res.drafted;
          return res;
        });
        toUpdate.push(draft);
      }
    }

    if (toUpdate.length > 0) {
      await Draft.batchPut(toUpdate);
    }

    index += batch.length;
    console.log(`Updated ${index} drafts`);
  }

  console.log('Done');
  process.exit(0);
})();
