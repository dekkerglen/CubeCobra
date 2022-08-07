// dotenv
require('dotenv').config();

const createClient = require('../util');

const cardutil = require('../../dist/utils/Card');
const carddb = require('../../serverjs/cards');

const FIELDS = {
  ORACLE_ID: 'OracleId',
  CUBED_WITH: 'CubedWith',
  DRAFTED_WITH: 'DraftedWith',
};

const client = createClient({
  name: 'CARD_METADATA',
  partitionKey: FIELDS.ORACLE_ID,
  attributes: {
    [FIELDS.ORACLE_ID]: 'S',
  },
  FIELDS,
});

module.exports = {
  getByOracle: async (oracle) => (await client.get(oracle)).Item,
  put: async (document) => {
    return client.put(document);
  },
  batchPut: async (documents) => {
    const keys = new Set();
    const items = [];

    for (const item of documents) {
      const key = item[FIELDS.ORACLE_ID];
      if (!keys.has(key)) {
        keys.add(key);
        items.push(item);
      }
    }

    await client.batchPut(items);
  },
  updateWithCubedWith: async (documents) => {
    const items = await client.batchGet(documents.map((document) => document[FIELDS.ORACLE_ID]));

    for (const item of items) {
      const document = documents.find((c) => c[FIELDS.ORACLE_ID] === item[FIELDS.ORACLE_ID]);
      if (document) {
        item.CubedWith = document.CubedWith;
      } else {
        item.CubedWith = {
          synergistic: [],
          top: [],
          creatures: [],
          spells: [],
          other: [],
        };
      }
    }

    await client.batchPut(items);
  },
  createTable: async () => client.createTable(),
  convertCardHistory: (history) => {
    return [
      {
        [FIELDS.ORACLE_ID]: history.oracleId,
        [FIELDS.CUBED_WITH]: history.cubedWith,
      },
    ];
  },
  convertCardRating: (cardrating) => {
    const ids = carddb.nameToId[cardutil.normalizeName(cardrating.name)];
    if (ids) {
      const card = carddb.cardFromId(ids[0]);
      const oracle = card.oracle_id;

      return [
        {
          [FIELDS.ORACLE_ID]: oracle,
          [FIELDS.EMBEDDING]: cardrating.embedding,
        },
      ];
    }

    return [];
  },
  FIELDS,
};
