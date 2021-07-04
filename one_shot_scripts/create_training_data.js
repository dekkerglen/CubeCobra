// Load Environment Variables
require('dotenv').config();

const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const Draft = require('../models/draft');
const carddb = require('../serverjs/cards.js');
const { getDrafterState } = require('../dist/drafting/draftutil');

const BATCH_SIZE = 10000;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// converts a draft into a list of decisions
const convertDraft = (draft, seatNumber = 0) => {
  try {
    const result = [];

    const { pickorder, trashorder } = draft.seats[seatNumber];
    const numToTake = pickorder.length + trashorder.length;

    // loop through each card picked or trashed
    let prevPickedNum = 0;
    for (let pickNumber = 0; pickNumber <= numToTake; pickNumber++) {
      // get the state of the draft at this point in time
      const { cardsInPack, pickedNum, picked, seen } = getDrafterState({ draft, seatNumber, pickNumber }, true);
      let pickedIndex = -1;

      // this mechanism skips trashes
      if (pickedNum > prevPickedNum) {
        pickedIndex = pickorder[prevPickedNum];
      }
      prevPickedNum = pickedNum;

      // if we picked a card and there are cards we picked over it
      if (pickedIndex !== -1 && cardsInPack.length > 0) {
        result.push({
          pick: draft.cards[pickedIndex].cardID,
          pack: cardsInPack.map((idx) => draft.cards[idx].cardID),
          picked: picked.map((idx) => draft.cards[idx].cardID),
          seen: seen.map((idx) => draft.cards[idx].cardID),
        });
      }
    }

    return result;
  } catch (err) {
    return [];
  }
};

const run = async () => {
  console.log(`Starting create_training_data...`);

  await carddb.initializeCardDb();
  await mongoose.connect(process.env.MONGODB_URL);

  const count = await Draft.estimatedDocumentCount();
  console.log(`Counted ${count} documents`);

  const cursor = Draft.find().cursor();

  let counter = 0;
  let points = 0;
  let file = 0;
  const data = [];

  for (let i = 0; i < count; i++) {
    const res = convertDraft(await cursor.next());
    if (res.length > 0) {
      counter += 1;
      points += res.length;
      data.push(...res);
      console.log(`Draft ${i} / ${count} - ${counter} viable drafts, ${points} data points.`);
      if (data.length > BATCH_SIZE) {
        const upload = data.splice(0, BATCH_SIZE);
        const params = {
          Bucket: 'cubecobra',
          Key: `draft_picks/${file}.json`,
          Body: JSON.stringify(upload),
        };
        await s3.upload(params).promise();
        file += 1;
      }
    }
  }
  const params = {
    Bucket: 'cubecobra',
    Key: `draft_picks/${file}.json`,
    Body: JSON.stringify(data),
  };
  await s3.upload(params).promise();
  file += 1;

  mongoose.disconnect();
  console.log('done');
  process.exit();
};

run();
