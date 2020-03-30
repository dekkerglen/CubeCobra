const mongoose = require('mongoose');
const fs = require('fs');
const Draft = require('../models/draft');
const mongosecrets = require('../../cubecobrasecrets/mongodb');
const carddb = require('../serverjs/cards.js');

const batchSize = 100;
(async () => {
  await carddb.initializeCardDb();

  mongoose.connect(mongosecrets.connectionString).then(async () => {
    console.log(`starting...`);
    const count = await Draft.countDocuments();
    console.log(`counted...`);
    const cursor = Draft.find()
      .lean()
      .cursor();

    console.log(`${count} documents to export`);
    let index = 0;
    // batch them
    for (let i = 0; i < count; i += batchSize) {
      const queries = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const draft = await cursor.next();
            if (draft) {
              // eslint-disable-next-line no-await-in-loop
              queries.push(draft);
            }
          } catch (err) {
            console.error(err);
          }
        }
      }
      console.log(`Writing... ${Math.min(count, i + batchSize)} of ${count} drafts`);
      try {
        // eslint-disable-next-line no-await-in-loop
        const data = await Promise.all(queries);
        fs.writeFileSync(`private/export/draft/draft.${index}.json`, JSON.stringify(data));
      } catch (err) {
        console.error(err);
      }
      index += 1;
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
