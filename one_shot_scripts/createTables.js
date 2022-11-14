// Load Environment Variables
require('dotenv').config();

const content = require('../dynamo/models/content');
const notification = require('../dynamo/models/notification');
const user = require('../dynamo/models/user');
const notice = require('../dynamo/models/notice');
const cubeMetadata = require('../dynamo/models/cube');
const cubeHash = require('../dynamo/models/cubeHash');
const cubeChangelog = require('../dynamo/models/changelog');
const blog = require('../dynamo/models/blog');
const cardHistory = require('../dynamo/models/cardhistory');
const cardMetadata = require('../dynamo/models/cardMetadata');
const comment = require('../dynamo/models/comment');
const cubeAnalytic = require('../dynamo/models/cubeAnalytic');
const draft = require('../dynamo/models/draft');
const package = require('../dynamo/models/package');
const patron = require('../dynamo/models/patron');
const passwordReset = require('../dynamo/models/passwordReset');
const featuredQueue = require('../dynamo/models/featuredQueue');
const feed = require('../dynamo/models/feed');

const tables = [
  // content,
  notification,
  // user,
  // notice,
  // cubeMetadata,
  // cubeHash,
  // cubeChangelog,
  // blog,
  // cardHistory,
  cardMetadata,
  // comment,
  cubeAnalytic,
  // draft,
  // package,
  // patron,
  // passwordReset,
  // featuredQueue,
  // feed
];

(async () => {
  for (const table of tables) {
    try {
      const result = await table.createTable();
      console.log(result);
    } catch(e) {
      console.log(`Error creating table ${table}: ${e}`);
      console.error(e);
    }
  }
  // exit
  process.exit(0);
})();
