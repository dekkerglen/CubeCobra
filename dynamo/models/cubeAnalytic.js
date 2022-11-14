/* eslint-disable prefer-destructuring */
/* eslint-disable no-await-in-loop */
// dotenv
require('dotenv').config();

const createClient = require('../util');

const cardutil = require('../../dist/utils/Card');
const carddb = require('../../serverjs/cards');

const FIELDS = {
  CUBE_ID: 'cube',
  ORACLE: 'oracle',
  PICKS: 'picks',
  PASSES: 'passes',
  MAINBOARDS: 'mainboards',
  SIDEBOARDS: 'sideboards',
  ELO: 'elo',
};

const client = createClient({
  name: 'CUBE_ANALYTIC',
  partitionKey: FIELDS.CUBE_ID,
  sortKey: FIELDS.ORACLE,
  attributes: {
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.ORACLE]: 'S',
  },
  FIELDS,
});

module.exports = {
  getByCubeIdAndOracle: async (cubeId, oracle) =>
    (await client.getByKey({ [FIELDS.CUBE_ID]: cubeId, [FIELDS.ORACLE]: oracle })).Item,
  getByCube: async (cubeId) => {
    let lastKey;
    const items = [];

    do {
      const res = await client.query({
        KeyConditionExpression: '#cubeId = :cube',
        ExpressionAttributeNames: {
          '#cubeId': FIELDS.CUBE_ID,
        },
        ExpressionAttributeValues: {
          ':cube': cubeId,
        },
        ExclusiveStartKey: lastKey,
        Limit: 10000,
      });

      items.push(...res.Items);
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    return Object.fromEntries(items.map((item) => [item[FIELDS.ORACLE], item]));
  },
  put: async (document) => {
    return client.put(document);
  },
  pushUpdates: async (updates) => {
    const groupedByOracle = {};
    for (const field of ['mainboards', 'sideboards', 'picks', 'passes']) {
      for (const entry of Object.entries(updates[field])) {
        groupedByOracle[entry[0]] = groupedByOracle[entry[0]] || {};
        groupedByOracle[entry[0]][field] = entry[1];
      }
    }

    await Promise.all(
      Object.entries(groupedByOracle).map(async ([oracle, update]) => {
        // INCREMENT
        await client.update({
          Key: { [FIELDS.CUBE_ID]: update.cube, [FIELDS.ORACLE]: oracle },
          UpdateExpression: 'ADD #mainboards :mainboards, #sideboards :sideboards, #picks :picks, #passes :passes',
          ExpressionAttributeNames: {
            '#mainboards': FIELDS.MAINBOARDS,
            '#sideboards': FIELDS.SIDEBOARDS,
            '#picks': FIELDS.PICKS,
            '#passes': FIELDS.PASSES,
          },
          ExpressionAttributeValues: {
            ':mainboards': update.mainboards || 0,
            ':sideboards': update.sideboards || 0,
            ':picks': update.picks || 0,
            ':passes': update.passes || 0,
          },
        });
      }),
    );
  },
  batchPut: async (documents) => {
    const items = [];
    const keys = new Set();

    for (const item of documents) {
      const key = `${item[FIELDS.CUBE_ID]}:${item[FIELDS.ORACLE]}`;
      if (!keys.has(key)) {
        keys.add(key);
        items.push(item);
      }
    }

    await client.batchPut(items);
  },
  createTable: async () => client.createTable(),
  convertCubeAnalytic: (analytic) => {
    const res = [];

    for (const card of analytic.cards) {
      if (card.cardName) {
        const ids = carddb.nameToId[cardutil.normalizeName(card.cardName)];
        if (ids) {
          const details = carddb.cardFromId(ids[0]);
          res.push({
            [FIELDS.CUBE_ID]: `${analytic.cube}`,
            [FIELDS.ORACLE]: details.oracle_id,
            [FIELDS.PICKS]: card.picks,
            [FIELDS.PASSES]: card.passes,
            [FIELDS.ELO]: card.elo,
            [FIELDS.MAINBOARDS]: card.mainboards,
            [FIELDS.SIDEBOARDS]: card.sideboards,
          });
        }
      }
    }

    return res;
  },
  FIELDS,
};
