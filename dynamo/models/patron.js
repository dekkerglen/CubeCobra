const createClient = require('../util');

const FIELDS = {
  OWNER: 'Owner',
  EMAIL: 'Email',
  STATUS: 'Status',
  LEVEL: 'Level',
};

const STATUSES = {
  ACTIVE: 'a',
  INACTIVE: 'i',
};

const LEVELS = ['Patron', 'Cobra Hatchling', 'Coiling Oracle', 'Lotus Cobra'];

const client = createClient({
  name: 'PATRON',
  partitionKey: FIELDS.OWNER,
  attributes: {
    [FIELDS.OWNER]: 'S',
    [FIELDS.EMAIL]: 'S',
  },
  indexes: [
    {
      name: 'ByEmail',
      partitionKey: FIELDS.EMAIL,
    },
  ],
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  getByEmail: async (email) =>
    (
      await client.query({
        IndexName: 'ByEmail',
        KeyConditionExpression: 'Email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
      })
    ).Items[0],
  put: async (document) => client.put(document),
  batchPut: async (documents) => {
    const keys = new Set();
    const items = [];

    for (const document of documents) {
      if (!keys.has(document.Owner)) {
        keys.add(document.Owner);
        items.push(document);
      }
    }

    await client.batchPut(items);
  },
  createTable: async () => client.createTable(),
  convertPatron: (document) => {
    return {
      [FIELDS.OWNER]: `${document.user}`,
      [FIELDS.EMAIL]: document.email,
      [FIELDS.STATUS]: document.active ? STATUSES.ACTIVE : STATUSES.INACTIVE,
      [FIELDS.LEVEL]: LEVELS.findIndex((level) => level === document.level),
    };
  },
  deleteById: async (id) => client.delete(id),
  FIELDS,
  STATUSES,
  LEVELS,
};
