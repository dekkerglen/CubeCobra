// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const Cube = require('../models/old/cube');

const cubeModel = require('../src/dynamo/models/cube');

const skip = 0;
const batchSize = 100;

const query = {};

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);

  console.log(`Fixing followers...`);
  const count = await Cube.countDocuments(query);
  const cursor = Cube.find(query).skip(skip).lean().cursor();
  const starttime = new Date();

  console.log(`Deck: Found ${count} items. Starting migration...`);

  // batch them by batchSize
  for (let i = skip; i < count; i += batchSize) {
    const items = [];
    for (let j = 0; j < batchSize; j++) {
      if (i + j < count) {
        const item = await cursor.next();
        if (item && item.users_following && item.users_following.length > 0) {
          items.push(item);
        }
      }
    }

    // get the dynamo items
    const ids = items.map((item) => `${item._id}`);
    const dynamoItems = await cubeModel.batchGetUnhydrated(ids);

    // update the dynamo items
    for (let j = 0; j < dynamoItems.length; j++) {
      const dynamoItem = dynamoItems[j];
      const matchingItem = items.find((item) => item._id.equals(dynamoItem.id));

      if (matchingItem) {
        dynamoItem.following = [
          ...new Set([...(dynamoItem.following || []), ...matchingItem.users_following.map((item) => `${item}`)]),
        ];
      }
    }

    // save the dynamo items
    await cubeModel.batchPut(dynamoItems);

    const currentTime = new Date();
    const timeElapsed = (currentTime - starttime) / 1000;
    const documentsRemaining = count - i;
    const documentProcessed = i - skip;
    const timeRemaining = (timeElapsed / documentProcessed) * documentsRemaining;
    console.log(
      `Cube: Finished: ${Math.min(i + batchSize, count)} of ${count} items. Time elapsed: ${Math.round(timeElapsed / 36) / 100
      } hours. Time remaining: ${Math.round(timeRemaining / 36) / 100} hours`,
    );
  }
  process.exit();
})();
