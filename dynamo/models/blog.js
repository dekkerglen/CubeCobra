// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');
const TurndownService = require('turndown');
const createClient = require('../util');
const { getChangelogFromBlog } = require('./changelog');

const turndownService = new TurndownService();

const FIELDS = {
  ID: 'Id',
  BODY: 'Body',
  OWNER: 'Owner',
  DATE: 'Date',
  CUBE_ID: 'CubeId',
  TITLE: 'Title',
  CHANGELIST_ID: 'ChangelistId',
};

const client = createClient({
  name: 'BLOG',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.ID]: 'S',
    [FIELDS.OWNER]: 'S',
  },
  indexes: [
    {
      name: 'ByCube',
      partitionKey: FIELDS.CUBE_ID,
      sortKey: FIELDS.DATE,
    },
    {
      name: 'ByOwner',
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
    },
  ],
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  getByCubeId: async (cubeId, lastKey) => {
    const result = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: `#p1 = :cubeId`,
      ExpressionAttributeValues: {
        ':cubeId': cubeId,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.CUBE_ID,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: result.Items,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  },
  getByOwner: async (owner, lastKey) => {
    const result = await client.query({
      IndexName: 'ByOwner',
      KeyConditionExpression: `#p1 = :owner`,
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.OWNER,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: result.Items,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    return client.put({
      [FIELDS.ID]: document[FIELDS.ID] || uuid(),
      [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
      [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.BODY]: document[FIELDS.BODY].substring(0, 10000),
      [FIELDS.TITLE]: document[FIELDS.TITLE],
      [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
    });
  },
  batchPut: async (documents) => {
    await client.batchPut(
      documents.map((document) => ({
        [FIELDS.ID]: document[FIELDS.ID],
        [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
        [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
        [FIELDS.OWNER]: document[FIELDS.OWNER],
        [FIELDS.BODY]: document[FIELDS.BODY].substring(0, 10000),
        [FIELDS.TITLE]: document[FIELDS.TITLE],
        [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
      })),
    );
  },
  createTable: async () => client.createTable(),
  convertBlog: (blog) => {
    const changelog = getChangelogFromBlog(blog);
    let body = blog.markdown || blog.body || '';

    if (blog.dev === 'true') {
      body = blog.html ? turndownService.turndown(blog.html) : blog.body;
    }

    return {
      [FIELDS.ID]: `${blog._id}`,
      [FIELDS.CUBE_ID]: blog.dev === 'true' ? `DEVBLOG` : `${blog.cube}`,
      [FIELDS.DATE]: blog.date.valueOf(),
      [FIELDS.OWNER]: `${blog.owner}`,
      [FIELDS.BODY]: body,
      [FIELDS.TITLE]: blog.title,
      [FIELDS.CHANGELIST_ID]: changelog.length > 0 ? `${blog._id}` : undefined,
    };
  },
  FIELDS,
};
