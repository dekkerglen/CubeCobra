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
const cubeAnalytic = require('../dynamo/models/cubeAnalytic');
const draft = require('../dynamo/models/draft');
const package = require('../dynamo/models/package');
const packageHash = require('../dynamo/models/packageHash');
const patron = require('../dynamo/models/patron');
const passwordReset = require('../dynamo/models/passwordReset');

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
const CubeAnalytic = require('../models/cubeAnalytic');
const Deck = require('../models/deck');
const Draft = require('../models/draft');
const Package = require('../models/package');
const Patron = require('../models/patron');
const PasswordReset = require('../models/passwordReset');


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
    source: Blog,
    conversions: [
      [changelog.getChangelogFromBlog, changelog.batchPut],
      // [blog.convertBlog, blog.batchPut],
    ],
  },
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
  // {
  //   source: Comment,
  //   conversions: [
  //     [comment.convertComment, comment.batchPut],
  //   ],
  // },
  // {
  //   source: CubeAnalytic,
  //   conversions: [
  //     [cubeAnalytic.convertCubeAnalytic, cubeAnalytic.batchPut],
  //   ],
  // },
  // {
  //   source: Deck,
  //   conversions: [
  //     [draft.convertDeck, draft.batchPut],
  //   ],
  // },
  // {
  //   source: Draft,
  //   conversions: [
  //     [draft.convertDraft, draft.updateDeckWithDraft],
  //   ],
  // },
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
  //     [
  //       (p) => packageHash.getHashRows(package.convertPackage(p)),
  //       packageHash.batchPut,
  //     ]
  //   ],
  // },
  // {
  //   source: Patron,
  //   conversions: [
  //     [patron.convertPatron, patron.batchPut],
  //   ],
  // }
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
      console.log(`${mongo.collection.collectionName}: Finished: ${i} of ${count} items`);
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
