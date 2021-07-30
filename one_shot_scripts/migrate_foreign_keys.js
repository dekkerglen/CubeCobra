/* eslint-disable no-await-in-loop */
// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Application = require('../models/application');
const Article = require('../models/article');
const Blog = require('../models/blog');
const Comment = require('../models/comment');
const Cube = require('../models/cube');
const CubeAnalytic = require('../models/cubeAnalytic');
const Deck = require('../models/deck');
const Draft = require('../models/draft');
const GridDraft = require('../models/gridDraft');
const Package = require('../models/package');
const Patron = require('../models/patron');
const Podcast = require('../models/podcast');
const PodcastEpisode = require('../models/podcastEpisode');
const Report = require('../models/report');
const User = require('../models/user');
const Video = require('../models/video');

const batchSize = 100;
const Id = (x, obj) => {
  // ObjectId(null) returns a newly created ObjectId, which we don't want
  if (!x || x === '') return null;
  if (!/^[0-9a-fA-F]{24}/.test(x)) {
    console.error(`Cannot convert value ${x} to Id`, obj);
    return x; // preserve the string rather than losing data. we can fix these later
  }
  return mongoose.Types.ObjectId(x);
};

const convertProps = (paths) => (obj) => {
  let id;
  for (const path of paths) {
    if (Array.isArray(obj[path])) {
      id = [];
      for (let i = 0; i < obj[path].length; i++) {
        id[i] = Id(id[i], obj);
      }
    } else {
      id = Id(obj[path], obj);
    }
    obj.markModified(path);
  }
};

const processGridDraft = (g) => {
  g.cube = Id(g.cube);
  for (const seat of g.seats) {
    seat.userid = Id(seat.userid, g);
  }
  g.markModified('cube');
  g.markModified('seats');
};

const processUser = (u) => {
  convertProps(['followed_cubes', 'followed_users', 'users_following', 'patron'])(u);
  for (const n of u.notifications) {
    n.user_from = Id(n.user_from, u);
  }
  for (const n of u.old_notifications) {
    n.user_from = Id(n.user_from, u);
  }
  u.markModified('notifications');
  u.markModified('old_notifications');
};

const processors = {
  application: [Application, convertProps(['userid'])],
  article: [Article, convertProps(['owner'])],
  blog: [Blog, convertProps(['owner', 'cube'])],
  comment: [Comment, convertProps(['parent', 'owner'])],
  cube: [Cube, convertProps(['owner', 'users_following'])],
  cubeAnalytic: [CubeAnalytic, convertProps(['cube'])],
  deck: [Deck, convertProps(['cube', 'cubeOwner', 'owner', 'draft'])],
  draft: [Draft, convertProps(['cube'])],
  gridDraft: [GridDraft, processGridDraft],
  package: [Package, convertProps(['userid', 'voters'])],
  patron: [Patron, convertProps(['user'])],
  podcast: [Podcast, convertProps(['owner'])],
  podcastEpisode: [PodcastEpisode, convertProps(['owner', 'podcast'])],
  report: [Report, convertProps(['commentid', 'reportee'])],
  user: [User, processUser],
  video: [Video, convertProps(['owner'])],
};

try {
  (async () => {
    await mongoose.connect(process.env.MONGODB_URL);

    // process all cube objects
    console.log('Started');

    for (const [name, value] of Object.entries(processors)) {
      console.log(`Running processor ${name}`);
      const [Model, func] = value;

      const count = await Model.countDocuments();
      const cursor = Model.find().cursor();

      // batch them by batchSize
      for (let i = 0; i < count; i += batchSize) {
        const items = [];
        for (let j = 0; j < batchSize; j++) {
          if (i + j < count) {
            const item = await cursor.next();
            if (item) {
              items.push(item);
            }
          }
        }
        await Promise.all(
          items.map(async (doc) => {
            func(doc);
            await doc.save();
          }),
        );
        console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} ${name} documents`);
      }
      console.log(`Finished processor ${name}`);
    }

    await mongoose.disconnect();
    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
