// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const carddb = require('../serverjs/cards');

const content = require('../dynamo/models/content');
const notification = require('../dynamo/models/notification');
const user = require('../dynamo/models/user');
const cube = require('../dynamo/models/cube');
const cubeHash = require('../dynamo/models/cubeHash');
const changelog = require('../dynamo/models/changelog');
const blog = require('../dynamo/models/blog');
const cardHistory = require('../dynamo/models/cardhistory');
const card = require('../dynamo/models/cardMetadata');
const comment = require('../dynamo/models/comment');

const Video = require('../models/old/video');
const Episode = require('../models/old/podcastEpisode');
const Podcast = require('../models/old/podcast');
const Article = require('../models/old/article');
const User = require('../models/old/user');
const Cube = require('../models/old/cube');
const Blog = require('../models/blog');
const CardHistory = require('../models/cardhistory');
const CardRating = require('../models/cardrating');
const Comment = require('../models/comment');

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
  //     [card.convertCardHistory, card.updateWithCubedWith],
  //   ],
  // }
  {
    source: Comment,
    conversions: [
      [comment.convertComment, comment.batchPut],
    ],
  }
];

const batchSize = 25;
const skip = 0;

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  await carddb.initializeCardDb();
  for (const migration of migrations) {
    const mongo = migration.source;

    console.log(`Moving over ${mongo.collection.collectionName}`);
    const count = await mongo.countDocuments();
    const cursor = mongo.find().skip(skip).lean().cursor();

    // batch them by batchSize
    for (let i = skip; i < count; i += batchSize) {
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
