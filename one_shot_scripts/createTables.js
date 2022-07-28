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

const tables = [
  // content,
  // notification,
  // user,
  // notice,
  //cubeMetadata,
  //cubeHash,
  // cubeChangelog,
  // blog,
  //cardHistory,
  // cardMetadata,
  comment
];

(async () => {
  for (const table of tables) {
    const result = await table.createTable();
    console.log(result);
  }
})();
