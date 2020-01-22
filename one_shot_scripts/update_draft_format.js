const mongoose = require('mongoose');
const Draft = require('../models/draft');
const mongosecrets = require('../../cubecobrasecrets/mongodb');

const batch_size = 100;

async function update(deck) {
  
}

(async () => {
  var i = 0;
  mongoose.connect(mongosecrets.connectionString).then(async (db) => {
    const count = await Draft.countDocuments();
    const cursor = Draft.find().cursor();

    //batch them in 100
    for (var i = 0; i < count; i += batch_size) {
      const drafts = [];
      for (var j = 0; j < batch_size; j++) {
        if (i + j < count) {
          let draft = await cursor.next();
          if (draft) {
            drafts.push(draft);
          }
        }
      }
      await Promise.all(drafts.map((draft) => update(draft)));
      console.log('Finished: ' + i + ' of ' + count + ' drafts');
    }
    mongoose.disconnect();
    console.log('done');
  });
})();
