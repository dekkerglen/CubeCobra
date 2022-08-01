const createClient = require('../util');

const FIELDS = {
  HASH: 'Hash',
  PACKAGE_ID: 'PackId',
  DATE: 'Date',
  FOLLOWER_COUNT: 'FollowerCount',
};

const client = createClient({
  name: 'PACKAGE_HASHES',
  partitionKey: FIELDS.HASH,
  sortKey: FIELDS.PACKAGE_ID,
  attributes: {
    [FIELDS.HASH]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.FOLLOWER_COUNT]: 'N',
    [FIELDS.PACKAGE_ID]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.DATE,
      name: 'SortedByDate',
    },
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.FOLLOWER_COUNT,
      name: 'SortedByFollowerCount',
    },
  ],
  FIELDS,
});

const hashKeywords = (metadata) => {
  const res = [];

  for (const word of metadata.Keywords) {
    res.push(`keywords:${word.replace(/[^\w\s]/gi, '').toLowerCase()}`);
  }

  return res;
};

const hashOracles = (metadata) => {
  const res = [];

  for (const card of metadata.Cards) {
    res.push(`oracle:${card}`);
  }
  return res;
};

const getHashes = (metadata) => {
  return [...new Set([...hashOracles(metadata), ...hashKeywords(metadata)])];
};

module.exports = {
  getSortedByFollowers: async (hash, ascending, lastKey) => {
    const result = await client.query({
      IndexName: 'SortedByFollowerCount',
      KeyConditionExpression: `#p1 = :hash`,
      ExpressionAttributeValues: {
        ':hash': hash,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.HASH,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: ascending,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  getSortedByDate: async (hash, ascending, lastKey) => {
    const result = await client.query({
      IndexName: 'SortedByDate',
      KeyConditionExpression: `#p1 = :hash`,
      ExpressionAttributeValues: {
        ':hash': hash,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.HASH,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: ascending,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document) => {
    if (!document[FIELDS.HASH] || !document[FIELDS.PACKAGE_ID]) {
      throw new Error('Invalid document: No partition or sort key provided');
    }
    return client.put(document);
  },
  put: async (document) =>
    client.put({
      ...document,
    }),
  batchPut: async (documents) => client.batchPut(documents),
  batchDelete: async (keys) => client.batchDelete(keys),
  createTable: async () => client.createTable(),
  getHashRows: (metadata) => {
    const hashes = getHashes(metadata);

    return hashes.map((hash) => ({
      [FIELDS.HASH]: hash,
      [FIELDS.DATE]: metadata.Date,
      [FIELDS.FOLLOWER_COUNT]: metadata.Voters.length,
      [FIELDS.PACKAGE_ID]: metadata.Id,
    }));
  },
  FIELDS,
};
