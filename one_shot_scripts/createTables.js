// Load Environment Variables
require('dotenv').config();

const content = require('../dynamo/models/content');
const notification = require('../dynamo/models/notification');
const user = require('../dynamo/models/user');
const notice = require('../dynamo/models/notice');
const cubeMetadata = require('../dynamo/models/cube');
const cubeHash = require('../dynamo/models/cubeHash');

const tables = [
  // content,
  // notification,
  // user,
  // notice,
  cubeMetadata,
  cubeHash,
];

(async () => {
  for (const table of tables) {
    const result = await table.createTable();
    console.log(result);
  }
})();
