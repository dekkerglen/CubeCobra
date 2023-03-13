// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');
const TurndownService = require('turndown');
const createClient = require('../util');
const Changelog = require('./changelog');
const carddb = require('../../serverjs/carddb');
const User = require('./user');
const Cube = require('./cube');

const turndownService = new TurndownService();

const FIELDS = {
  ID: 'id',
  BODY: 'body',
  OWNER: 'owner',
  DATE: 'date',
  CUBE_ID: 'cube',
  TITLE: 'title',
  CHANGELIST_ID: 'changelist',
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

const hydrate = async (document) => {
  document.owner = await User.getById(document.owner);
  document.cubeName = (await Cube.getById(document.cube)).name;

  if (!document.changelist) {
    return document;
  }

  const changelog = await Changelog.getById(document.cube, document.changelist);

  delete document.changelist;

  return {
    ...document,
    Changelog: changelog,
  };
};

const batchHydrate = async (documents) => {
  const keys = documents
    .filter((document) => document.changelist)
    .map((document) => ({ cube: document.cube, id: document.changelist }));
  const changelists = await Changelog.batchGet(keys);

  const owners = await User.batchGet(documents.map((document) => document.owner));
  const cubes = await Cube.batchGet(documents.map((document) => document.cube));

  return documents.map((document) => {
    document.owner = owners.find((owner) => owner.id === document.owner);
    document.cubeName = cubes.find((cube) => cube.id === document.cube).name;

    if (document.changelist) {
      const id = keys.findIndex((key) => key.id === document.changelist);
      document.Changelog = changelists[id];
    }

    delete document.changelist;

    return document;
  });
};

module.exports = {
  getById: async (id) => hydrate((await client.get(id)).Item),
  getUnhydrated: async (id) => (await client.get(id)).Item,
  getByCube: async (cube, limit, lastKey) => {
    const result = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: `#p1 = :cube`,
      ExpressionAttributeValues: {
        ':cube': cube,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.CUBE_ID,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 36,
    });
    return {
      items: await batchHydrate(result.Items),
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
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid();

    if (document.owner.id) {
      document[FIELDS.OWNER] = document.owner.id;
    }

    client.put({
      [FIELDS.ID]: id,
      [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
      [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.BODY]: document[FIELDS.BODY] ? document[FIELDS.BODY].substring(0, 10000) : null,
      [FIELDS.TITLE]: document[FIELDS.TITLE],
      [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
    });
    return id;
  },
  delete: async (id) => {
    await client.delete({ id });
  },
  batchPut: async (documents) => {
    await client.batchPut(
      documents.map((document) => ({
        [FIELDS.ID]: document[FIELDS.ID],
        [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
        [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
        [FIELDS.OWNER]: document[FIELDS.OWNER].id || document[FIELDS.OWNER],
        [FIELDS.BODY]: document[FIELDS.BODY].substring(0, 10000),
        [FIELDS.TITLE]: document[FIELDS.TITLE],
        [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
      })),
    );
  },
  batchGet: async (ids) => batchHydrate(await client.batchGet(ids)),
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
  changelogToText: (changelog) => {
    let result = '';

    for (const [board, name] of [
      ['mainboard', 'Mainboard'],
      ['sideboard', 'Sideboard'],
    ]) {
      if (changelog[board]) {
        result += `${name}:\n`;

        if (changelog[board].adds) {
          result += `Added:\n${changelog[board].adds.map((add) => carddb.cardFromId(add.cardID).name).join('\n')}\n`;
        }

        if (changelog[board].removes) {
          result += `Removed:\n${changelog[board].removes
            .map((remove) => carddb.cardFromId(remove.oldCard.cardID).name)
            .join('\n')}\n`;
        }

        if (changelog[board].swaps) {
          result += `Swapped:\n${changelog[board].swaps
            .map(
              (swap) => `${carddb.cardFromId(swap.oldCard.cardID).name} -> ${carddb.cardFromId(swap.card.cardID).name}`,
            )
            .join('\n')}\n`;
        }

        if (changelog[board].edits) {
          result += `Edited:\n${changelog[board].edits
            .map((edit) => `${carddb.cardFromId(edit.oldCard.cardID).name}`)
            .join('\n')}\n`;
        }
      }
    }

    return result;
  },
  FIELDS,
};
