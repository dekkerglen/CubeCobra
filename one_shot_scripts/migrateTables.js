// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const carddb = require('../serverjs/carddb');

const content = require('../dynamo/models/content');
const notification = require('../dynamo/models/notification');
const user = require('../dynamo/models/user');
const cube = require('../dynamo/models/cube');
const cubeHash = require('../dynamo/models/cubeHash');
const changelog = require('../dynamo/models/changelog');
const blog = require('../dynamo/models/blog');
const cardHistory = require('../dynamo/models/cardhistory');
const comment = require('../dynamo/models/comment');
const draft = require('../dynamo/models/draft');
const pack = require('../dynamo/models/package');
const patron = require('../dynamo/models/patron');
const featuredQueue = require('../dynamo/models/featuredQueue');

const Video = require('../models/old/video');
const Episode = require('../models/old/podcastEpisode');
const Podcast = require('../models/old/podcast');
const Article = require('../models/old/article');
const User = require('../models/old/user');
const Cube = require('../models/old/cube');
const Blog = require('../models/old/blog');
const CardHistory = require('../models/old/cardhistory');
const CardRating = require('../models/old/cardrating');
const Comment = require('../models/old/comment');
const Deck = require('../models/old/deck');
const Draft = require('../models/old/draft');
const Package = require('../models/old/package');
const Patron = require('../models/old/patron');
const FeaturedQueue = require('../models/old/featuredCubes');

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
  //     // [user.convertUser, user.batchPut],
  //   ],
  // },
  // {
  //   source: Blog,
  //   conversions: [
  //     [changelog.getChangelogFromBlog, changelog.batchPut],
  //     [blog.convertBlog, blog.batchPut],
  //   ],
  // },
  // {
  //   source: CardRating,
  //   conversions: [
  //     [card.convertCardRating, card.batchPut],
  //   ]
  // },
  // {
  //   source: CardHistory,
  //   conversions: [
  //     [cardHistory.convertCardHistory, cardHistory.batchPut],
  //     // [card.convertCardHistory, card.updateWithCubedWith],
  //   ],
  // },
  // {
  //   source: Comment,
  //   conversions: [
  //     [comment.convertComment, comment.batchPut],
  //   ],
  // },
  {
    source: Deck,
    conversions: [[draft.convertDeck, draft.batchPut]],
  },
  // {
  //   source: Cube,
  //   conversions: [
  //     [cube.convertCubeToMetadata, cube.batchPut],
  //     [cube.convertCubeToCards, cube.batchPutCards],
  //     [
  //       (c) => cubeHash.getHashRowsForCube(cube.convertCubeToMetadata(c), cube.convertCubeToCards(c)),
  //       cubeHash.batchPut,
  //     ],
  //   ],
  // },
  // {
  //   source: Package,
  //   conversions: [
  //     [package.convertPackage, package.batchPut],
  //   ],
  // },
  // {
  //   source: Patron,
  //   conversions: [
  //     [patron.convertPatron, patron.batchPut],
  //   ],
  // },
  // {
  //   source: FeaturedQueue,
  //   conversions: [
  //     [featuredQueue.convertQueue, featuredQueue.batchPut],
  //   ],
  // }
];

const batchSize = 100;
const skip = 0;

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();
  for (const migration of migrations) {
    const mongo = migration.source;

    console.log(`Moving over ${mongo.collection.collectionName}`);
    const count = await mongo.countDocuments({ _id: '5dde88af89469844a079b2f1' });
    const cursor = mongo.find({ _id: '5dde88af89469844a079b2f1' }).skip(skip).lean().cursor();
    const starttime = new Date();

    // batch them by batchSize
    for (let i = skip; i < count; i += batchSize) {
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
        if (converted.length > 0) {
          await put(converted);
        }
      }
      const currentTime = new Date();
      const timeElapsed = (currentTime - starttime) / 1000;
      const documentsRemaining = count - i;
      const documentProcessed = i - skip;
      const timeRemaining = (timeElapsed / documentProcessed) * documentsRemaining;
      console.log(
        `${mongo.collection.collectionName}: Finished: ${Math.min(
          i + batchSize,
          count,
        )} of ${count} items. Time elapsed: ${Math.round(timeElapsed / 36) / 100} hours. Time remaining: ${
          Math.round(timeRemaining / 36) / 100
        } hours`,
      );
    }
  }
  process.exit();
})();
