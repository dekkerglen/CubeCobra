/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');
const AWS = require('aws-sdk');

const Draft = require('../models/draft');
const carddb = require('../serverjs/cards');
const draftutil = require('../dist/drafting/draftutil');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const batchSize = 1000;

const processDraftToPicks = async (draft) => {
  console.log(draft._id);
  const res = [];

  for (let i = 0; i < draft.seats[0].drafted.length; i++) {
    const state = draftutil.getDrafterState(draft, 0, i);
    console.log(state);

    if (state.step.action === 'pick') {
      res.push({
        selection: state.selection,
        cardsInPack: state.cardsInPack,
        picked: state.picked,
        pack: state.pack,
        pick: state.pick,
      });
    }
  }

  console.log(res);

  return res;
};

const writeToS3 = async (fileName, body) => {
  const params = {
    Bucket: 'cubecobra',
    Key: `${fileName}`,
    Body: JSON.stringify(body),
  };
  await s3.upload(params).promise();
};

(async () => {
  await carddb.initializeCardDb();

  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // process all deck objects
    console.log('Started');
    // const count = await Draft.countDocuments();
    // console.log(`Counted ${count} documents`);

    const count = 1;

    const cursor = Draft.find().lean().cursor();
    let counter = 0;
    for (let i = 0; i < count; i += batchSize) {
      const drafts = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          drafts.push(await cursor.next());
        }
      }

      const processedDecks = drafts.map((draft) => processDraftToPicks(draft)).flat(1);
      if (processedDecks.length > 0) {
        await writeToS3(`picks/${counter}.json`, processedDecks);
        counter += 1;
      }
      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} drafts`);
    }
    await mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
