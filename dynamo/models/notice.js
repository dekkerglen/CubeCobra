const createClient = require('../util');

const FIELDS = {
  ID: 'Id',
  DATE: 'Date',
  USER: 'User',
  BODY: 'Body',
  STATUS: 'Status',
  TYPE: 'Type',
  SUBJECT: 'Subject',
};

const TYPE = {
  APPLICATION: 'a',
  COMMENT_REPORT: 'cr',
};

const STATUS = {
  ACTIVE: 'a',
  PROCESSED: 'p',
};

const client = createClient({
  name: 'NOTICES',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.STATUS]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.STATUS,
      sortKey: FIELDS.DATE,
      name: 'ByStatus',
    },
  ],
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  getByStatus: async (to, lastKey) => {
    const result = await client.query({
      IndexName: 'ByStatus',
      KeyConditionExpression: `#p1 = :to`,
      ExpressionAttributeValues: {
        ':to': `${to}`,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.STATUS,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document) => {
    if (!document[FIELDS.ID]) {
      throw new Error('Invalid document: No partition key provided');
    }
    return client.put(document);
  },
  put: async (document) =>
    client.put({
      [FIELDS.STATUS]: STATUS.ACTIVE,
      ...document,
    }),
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
  STATUS,
  FIELDS,
  TYPE,
};
