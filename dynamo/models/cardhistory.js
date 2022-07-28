// dotenv
require('dotenv').config();

const createClient = require('../util');

const cardutil = require('../../dist/utils/Card');

const FIELDS = {
  ORACLE_ID: 'OracleId',
  DATE: 'Date',
  ELO: 'Elo',
  PICKS: 'Picks',
  CUBES: 'Cubes',
  PRICES: 'Prices',
  SIZE180: 'Size180',
  SIZE360: 'Size360',
  SIZE450: 'Size450',
  SIZE540: 'Size540',
  SIZE720: 'Size720',
  PAUPER: 'Pauper',
  PEASANT: 'Peasant',
  LEGACY: 'Legacy',
  MODERN: 'Modern',
  STANDARD: 'Standard',
  VINTAGE: 'Vintage',
  TOTAL: 'Total',
};

const client = createClient({
  name: 'CARD_HISTORY',
  partitionKey: FIELDS.ORACLE_ID,
  sortKey: FIELDS.DATE,
  attributes: {
    [FIELDS.ORACLE_ID]: 'S',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

module.exports = {
  getByCardName: async (name) => (await client.get(cardutil.normalizeName(name))).Item,
  put: async (document) => {
    return client.put(document);
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
      if (datapoint.date) {
        const [year, month, day] = datapoint.date.split('-');
        const date = new Date(year, month - 1, day);

        res.push({
          [FIELDS.ORACLE_ID]: history.oracleId,
          [FIELDS.DATE]: date.valueOf(),
          [FIELDS.ELO]: data.elo,
          [FIELDS.PICKS]: data.picks,
          [FIELDS.CUBES]: data.cubes,
          [FIELDS.PRICES]: Object.fromEntries(
            data.prices.map((item) => [
              item.version,
              {
                Usd: item.price,
                UsdFoil: item.price_foil,
                UsdEtched: item.price_etched,
                Eur: item.eur,
                Tix: item.tix,
              },
            ]),
          ),
          [FIELDS.SIZE180]: data.size180,
          [FIELDS.SIZE360]: data.size360,
          [FIELDS.SIZE450]: data.size450,
          [FIELDS.SIZE540]: data.size540,
          [FIELDS.SIZE720]: data.size720,
          [FIELDS.PAUPER]: data.pauper,
          [FIELDS.PEASANT]: data.peasant,
          [FIELDS.LEGACY]: data.legacy,
          [FIELDS.MODERN]: data.modern,
          [FIELDS.STANDARD]: data.standard,
          [FIELDS.VINTAGE]: data.vintage,
          [FIELDS.TOTAL]: data.total,
        });
      }
    }

    const keys = new Set();
    const items = [];

    for (const item of res) {
      const key = `${item[FIELDS.CARD_NAME]}-${item[FIELDS.DATE]}`;
      if (!keys.has(key)) {
        keys.add(key);
        items.push(item);
      }
    }

    return items;
  },
  FIELDS,
};
