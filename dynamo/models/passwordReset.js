const uuid = require('uuid/v4');
const createClient = require('../util');

const FIELDS = {
  ID: 'Id',
  OWNER: 'Owner',
  DATE: 'Date',
};

const client = createClient({
  name: 'RESETS',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
  },
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid();
    await client.put({
      [FIELDS.ID]: id,
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.DATE]: document[FIELDS.DATE],
    });
  },
  batchPut: async (documents) => {
    await client.batchPut(documents);
  },
  createTable: async () => client.createTable(),
  FIELDS,
};
