// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const carddb = require('../serverjs/cards');

const content = require('../dynamo/models/content');
const notification = require('../dynamo/models/notification');
const user = require('../dynamo/models/user');
const cube = require('../dynamo/models/cube');
const cubeHash = require('../dynamo/models/cubeHash');

const Video = require('../models/old/video');
const Episode = require('../models/old/podcastEpisode');
const Podcast = require('../models/old/podcast');
const Article = require('../models/old/article');
const User = require('../models/old/user');
const Cube = require('../models/cube');

const migrations = [
  // {
  //   source: Video,
  //   conversions: [[content.convertVideo, content.batchPut]],
  // },
  // {
  //   source: Episode,
  //   conversions: [[content.convertEpisode, content.batchPut]],
  // },
  // {
  //   source: Podcast,
  //   conversions: [[content.convertPodcast, content.batchPut]],
  // },
  // {
  //   source: Article,
  //   conversions: [[content.convertArticle, content.batchPut]],
  // },
  // {
  //   source: User,
  //   conversions: [
  //     [notification.getNotificationsFromUser, notification.batchPut],
  //     [user.convertUser, user.batchPut],
  //   ],
  // },
  {
    source: Cube,
    conversions: [
      [cube.convertCubeToMetadata, cube.batchPut],
      // [cube.convertCubeToCards, cube.batchPutCards],
      [
        (c) => cubeHash.getHashRowsForCube(cube.convertCubeToMetadata(c), cube.convertCubeToCards(c)),
        cubeHash.batchPut,
      ],
    ],
  },
];

const batchSize = 25;

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();
  for (const migration of migrations) {
    const mongo = migration.source;

    console.log(`Moving over ${mongo.collection.collectionName}`);
    const count = await mongo.countDocuments();
    const cursor = mongo.find().skip(5275).lean().cursor();

    // batch them by batchSize
    for (let i = 5275; i < count; i += batchSize) {
      console.log(`Finished: ${i} of ${count} items`);
      const items = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const item = await cursor.next();
          if (item) {
            items.push(item);
          }
        }
      }

      for (const [convert, put] of migration.conversions) {
        let converted = items.map(convert);

        // check for a 1:N relationship
        if (Array.isArray(converted[0])) {
          converted = converted.flat();
        }
        await put(converted);
      }
    }
  }
  process.exit();
})();
