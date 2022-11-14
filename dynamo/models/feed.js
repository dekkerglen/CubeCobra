const createClient = require('../util');
const Blog = require('./blog');

const FIELDS = {
  ID: 'id',
  TO: 'to',
  DATE: 'date',
  TYPE: 'Type',
};

const client = createClient({
  name: 'FEED',
  partitionKey: FIELDS.ID,
  sortKey: FIELDS.TO,
  indexes: [
    {
      name: 'ByTo',
      partitionKey: FIELDS.TO,
      sortKey: FIELDS.DATE,
    },
  ],
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.TO]: 'S',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

const TYPES = {
  BLOG: 'b',
};

module.exports = {
  batchPut: async (documents) => client.batchPut(documents),
  getByTo: async (user, lastKey) => {
    const result = await client.query({
      IndexName: 'ByTo',
      KeyConditionExpression: '#to = :to',
      ExpressionAttributeNames: {
        '#to': FIELDS.TO,
      },
      ExpressionAttributeValues: {
        ':to': user,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    const byType = {};
    result.Items.forEach((item) => {
      const type = item[FIELDS.TYPE];
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(item);
    });

    const results = await Promise.all(
      Object.keys(byType).map(async (type) => {
        if (type === TYPES.BLOG) {
          return Blog.batchGet(byType[type].map((item) => item[FIELDS.ID]));
        }
        return [];
      }),
    );

    // sort back together into one list
    const itemsById = {};
    results.forEach(({ Items }) => {
      Items.forEach((item) => {
        itemsById[item.id] = item;
      });
    });

    return {
      items: result.Items.map((document) => ({
        type: document[FIELDS.TYPE],
        document: itemsById[document[FIELDS.ID]],
      })),
      lastKey: result.LastEvaluatedKey,
    };
  },
  createTable: async () => client.createTable(),
  FIELDS,
  TYPES,
};
