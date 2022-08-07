// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');
const TurndownService = require('turndown');
const createClient = require('../util');
const Changelog = require('./changelog');

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

const hydrateChangelog = async (document) => {
  if (!document.ChangelistId) {
    return document;
  }

  const changelog = await Changelog.getById(document.CubeId, document.ChangelistId);

  delete document.ChangelistId;

  return {
    ...document,
    Changelog: changelog,
  };
};

module.exports = {
  getById: async (id) => hydrateChangelog((await client.get(id)).Item),
  getByCubeId: async (cubeId, limit, lastKey) => {
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
      Limit: limit || 36,
    });
    return {
      items: await Promise.all(result.Items.map(hydrateChangelog)),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByOwner: async (owner, limit, lastKey) => {
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
      Limit: limit || 36,
    });
    return {
      items: await Promise.all(result.Items.map(hydrateChangelog)),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid();
    client.put({
      [FIELDS.ID]: id,
      [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
      [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.BODY]: document[FIELDS.BODY].substring(0, 10000),
      [FIELDS.TITLE]: document[FIELDS.TITLE],
      [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
    });
    return id;
  },
  delete: async (id) => {
    await client.delete(id);
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
  batchGet: async (ids) => client.batchGet(ids),
  createTable: async () => client.createTable(),
  convertBlog: (blog) => {
    const changelog = Changelog.getChangelogFromBlog(blog);
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
