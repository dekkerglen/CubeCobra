// dotenv
require('dotenv').config();

const createClient = require('../util');

const TYPES = {
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
};

const FIELDS = {
  ORACLE_TYPE_COMP: 'OTComp',
  ORACLE_ID: 'oracle',
  DATE: 'date',
  ELO: 'elo',
  PICKS: 'picks',
  SIZE180: 'size180',
  SIZE360: 'size360',
  SIZE450: 'size450',
  SIZE540: 'size540',
  SIZE720: 'size720',
  PAUPER: 'pauper',
  PEASANT: 'peasant',
  LEGACY: 'legacy',
  MODERN: 'modern',
  VINTAGE: 'vintage',
  TOTAL: 'total',
};

const client = createClient({
  name: 'CARD_HISTORY',
  partitionKey: FIELDS.ORACLE_TYPE_COMP,
  sortKey: FIELDS.DATE,
  attributes: {
    [FIELDS.ORACLE_TYPE_COMP]: 'S',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

module.exports = {
  getByOracleAndType: async (oracle, type, limit, lastKey) => {
    const result = await client.query({
      KeyConditionExpression: `${FIELDS.ORACLE_TYPE_COMP} = :oracle`,
      ExpressionAttributeValues: {
        ':oracle': `${oracle}:${type}`,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 100,
    });

    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    return client.put(document, true);
  },
  batchPut: async (documents) => {
    await client.batchPut(documents);
  },
  createTable: async () => client.createTable(),
  convertCardHistory: (history) => {
    const res = [];

    for (const datapoint of history.history) {
      const { data } = datapoint;

      // 2020-6-16
      if (datapoint.date && history.oracleId) {
        const [year, month, day] = datapoint.date.split('-');
        const date = new Date(year, month - 1, day);

        res.push({
          [FIELDS.ORACLE_TYPE_COMP]: `${history.oracleId}:${TYPES.DAY}`,
          [FIELDS.ORACLE_ID]: history.oracleId,
          [FIELDS.DATE]: date.valueOf(),
          [FIELDS.ELO]: data.elo,
          [FIELDS.PICKS]: data.picks,
          [FIELDS.SIZE180]: data.size180,
          [FIELDS.SIZE360]: data.size360,
          [FIELDS.SIZE450]: data.size450,
          [FIELDS.SIZE540]: data.size540,
          [FIELDS.SIZE720]: data.size720,
          [FIELDS.PAUPER]: data.pauper,
          [FIELDS.PEASANT]: data.peasant,
          [FIELDS.LEGACY]: data.legacy,
          [FIELDS.MODERN]: data.modern,
          [FIELDS.VINTAGE]: data.vintage,
          [FIELDS.TOTAL]: data.total,
        });
      }
    }

    const keys = new Set();
    const items = [];

    for (const item of res) {
      const key = `${item[FIELDS.ORACLE_TYPE_COMP]}-${item[FIELDS.DATE]}`;
      if (!keys.has(key)) {
        keys.add(key);
        items.push(item);
      }
    }

    return items;
  },
  FIELDS,
  TYPES,
};
