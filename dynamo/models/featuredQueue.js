const createClient = require('../util');

const FIELDS = {
  CUBE: 'cube',
  DATE: 'date',
  OWNER: 'owner',
  FEATURED_ON: 'featuredOn',
  STATUS: 'status',
};

const STATUS = {
  ACTIVE: 'a',
  INACTIVE: 'i',
};

const client = createClient({
  name: 'FEATURED_QUEUE',
  partitionKey: FIELDS.CUBE,
  indexes: [
    {
      name: 'ByDate',
      partitionKey: FIELDS.STATUS,
      sortKey: FIELDS.DATE,
    },
  ],
  attributes: {
    [FIELDS.CUBE]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.STATUS]: 'S',
  },
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  put: async (document) => {
    await client.put({
      [FIELDS.CUBE]: document[FIELDS.CUBE],
      [FIELDS.DATE]: document[FIELDS.DATE],
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.FEATURED_ON]: document[FIELDS.FEATURED_ON],
      [FIELDS.STATUS]: STATUS.ACTIVE,
    });
  },
  querySortedByDate: async (lastKey) => {
    const query = {
      IndexName: 'ByDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': FIELDS.STATUS,
      },
      ExpressionAttributeValues: {
        ':status': STATUS.ACTIVE,
      },
    };
    if (lastKey) {
      query.ExclusiveStartKey = lastKey;
    }
    const result = await client.query(query);

    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryWithOwnerFilter: async (ownerID, lastKey) => {
    const query = {
      IndexName: 'ByDate',
      KeyConditionExpression: '#status = :status',
      FilterExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#status': FIELDS.STATUS,
        '#owner': FIELDS.OWNER,
      },
      ExpressionAttributeValues: {
        ':status': STATUS.ACTIVE,
        ':owner': ownerID,
      },
    };
    if (lastKey) {
      query.ExclusiveStartKey = lastKey;
    }
    const result = await client.query(query);

    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
  convertQueue: (queue) => {
    return queue.queue.map((item, index) => ({
      [FIELDS.CUBE]: `${item.cubeID}`,
      [FIELDS.OWNER]: `${item.ownerID}`,
      [FIELDS.DATE]: new Date().valueOf() - 1000 + index * 100, // make sure the 1st element is the oldest
      [FIELDS.FEATURED_ON]: index < 2 ? new Date().valueOf() : null,
      [FIELDS.STATUS]: STATUS.ACTIVE,
    }));
  },
  delete: async (id) => client.delete({ cube: id }),
  FIELDS,
};
