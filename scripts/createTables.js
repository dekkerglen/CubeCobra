// Load Environment Variables
require('dotenv').config();

const content = require('../src/dynamo/models/content');
const notification = require('../src/dynamo/models/notification');
const user = require('../src/dynamo/models/user');
const notice = require('../src/dynamo/models/notice');
const cubeMetadata = require('../src/dynamo/models/cube');
const cubeHash = require('../src/dynamo/models/cubeHash');
const cubeChangelog = require('../src/dynamo/models/changelog');
const blog = require('../src/dynamo/models/blog');
const cardhistory = require('../src/dynamo/models/cardhistory');
const comment = require('../src/dynamo/models/comment');
const draft = require('../src/dynamo/models/draft');
const pack = require('../src/dynamo/models/package');
const patron = require('../src/dynamo/models/patron');
const passwordReset = require('../src/dynamo/models/passwordReset');
const featuredQueue = require('../src/dynamo/models/featuredQueue');
const feed = require('../src/dynamo/models/feed');
const record = require('../src/dynamo/models/record');

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
