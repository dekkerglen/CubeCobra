// dotenv
require('dotenv').config();

const createClient = require('../util');

const cardutil = require('../../dist/utils/Card');
const carddb = require('../../serverjs/cards');

const FIELDS = {
  CUBE_ID: 'CubeId',
  ORACLE: 'Oracle',
  PICKS: 'Picks',
  PASSES: 'Passes',
  ELO: 'Elo',
  MAINBOARDS: 'Mainboards',
  SIDEBOARDS: 'Sideboards',
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
  put: async (document) => {
    return client.put(document);
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
