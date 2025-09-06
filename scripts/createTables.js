// Load Environment Variables
require('dotenv').config();

const content = require('../build/dynamo/models/content');
const notification = require('../build/dynamo/models/notification');
const user = require('../build/dynamo/models/user');
const notice = require('../build/dynamo/models/notice');
const cubeMetadata = require('../build/dynamo/models/cube');
const cubeHash = require('../build/dynamo/models/cubeHash');
const cubeChangelog = require('../build/dynamo/models/changelog');
const blog = require('../build/dynamo/models/blog');
const cardhistory = require('../build/dynamo/models/cardhistory');
const comment = require('../build/dynamo/models/comment');
const draft = require('../build/dynamo/models/draft');
const pack = require('../build/dynamo/models/package');
const patron = require('../build/dynamo/models/patron');
const passwordReset = require('../build/dynamo/models/passwordReset');
const featuredQueue = require('../build/dynamo/models/featuredQueue');
const feed = require('../build/dynamo/models/feed');
const record = require('../build/dynamo/models/record');
const p1p1Pack = require('../build/dynamo/models/p1p1Pack');

const tables = [
  content,
  notification,
  user,
  notice,
  cubeMetadata,
  cubeHash,
  cubeChangelog,
  blog,
  cardhistory,
  comment,
  draft,
  pack,
  patron,
  passwordReset,
  featuredQueue,
  feed,
  record,
  p1p1Pack,
];

(async () => {
  for (const table of tables) {
    try {
      const result = await table.createTable();
      console.log(result);
    } catch (e) {
      console.log(`Error creating table ${table}: ${e}`);
      console.error(e);
    }
  }
  // exit
  process.exit(0);
})();
