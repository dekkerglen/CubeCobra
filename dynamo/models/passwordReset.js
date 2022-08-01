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
  put: async (document) => client.put(document),
  batchPut: async (documents) => {
    await client.batchPut(documents);
  },
  createTable: async () => client.createTable(),
  FIELDS,
};
