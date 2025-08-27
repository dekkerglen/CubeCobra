const createClient = require('../util');

const { cardFromId } = require('../../util/carddb');

const FIELDS = {
  HASH: 'hash',
  CUBE_ID: 'cube',
  NUM_FOLLOWERS: 'numFollowers',
  NAME: 'name',
  CARD_COUNT: 'cardCount',
};

const client = createClient({
  name: 'CUBE_HASHES',
  partitionKey: FIELDS.CUBE_ID,
  sortKey: FIELDS.HASH,
  attributes: {
    [FIELDS.HASH]: 'S',
    [FIELDS.NUM_FOLLOWERS]: 'N',
    [FIELDS.CARD_COUNT]: 'N',
    [FIELDS.NAME]: 'S',
    [FIELDS.CUBE_ID]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.NUM_FOLLOWERS,
      name: 'SortedByFollowers',
    },
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.NAME,
      name: 'SortedByName',
    },
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.CARD_COUNT,
      name: 'SortedByCardCount',
    },
  ],
  FIELDS,
});

const getShortIdHash = (shortId) => {
  //Case sensitive!
  return `shortid:${shortId}`;
};

const hashShortId = (metadata) => {
  if (!metadata.shortId || metadata.shortId.length === 0) {
    return [];
  }
  return [getShortIdHash(metadata.shortId)];
};

const hashFeatured = (metadata) => {
  return [`featured:${metadata.featured}`];
};

const hashCategories = (metadata) => {
  if (!metadata.categoryOverride) {
    return [];
  }

  const res = [];

  res.push(`category:${metadata.categoryOverride}`);

  for (const prefix of metadata.categoryPrefixes || []) {
    res.push(`category:${prefix.toLowerCase()}`);
  }

  return res;
};

const hashTags = (metadata) => {
  return (metadata.tags || []).map((tag) => `tag:${tag.toLowerCase()}`);
};

const hashKeywords = (metadata) => {
  const res = [];

  const namewords = metadata.name
    .replace(/[^\w\s]/gi, '')
    .toLowerCase()
    .split(' ')
    .filter((keyword) => keyword.length > 0);

  for (let i = 0; i < namewords.length; i++) {
    for (let j = i + 1; j < namewords.length + 1; j++) {
      const slice = namewords.slice(i, j);
      res.push(`keywords:${slice.join(' ')}`);
    }
  }

  return res;
};

const hashOracles = (cards) => {
  const res = [];

  for (const card of cards.mainboard) {
    const oracle = cardFromId(card.cardID).oracle_id;

    if (oracle) {
      res.push(`oracle:${cardFromId(card.cardID).oracle_id}`);
    }
  }

  return res;
};

const getHashesForMetadata = (metadata) => {
  return [
    ...new Set([
      ...hashShortId(metadata),
      ...hashFeatured(metadata),
      ...hashCategories(metadata),
      ...hashTags(metadata),
      ...hashKeywords(metadata),
    ]),
  ];
};
const getHashesForCards = (cards) => {
  return [...new Set([...hashOracles(cards)])];
};

const getHashesForCube = (metadata, cards) => {
  return [...new Set([...getHashesForCards(cards), ...getHashesForMetadata(metadata)])];
};

const getSortedByFollowers = async (hash, ascending, lastKey, limit=36) => {
  const result = await client.query({
    IndexName: 'SortedByFollowers',
    KeyConditionExpression: `#p1 = :hash`,
    ExpressionAttributeValues: {
      ':hash': hash,
    },
    ExpressionAttributeNames: {
      '#p1': FIELDS.HASH,
    },
    ExclusiveStartKey: lastKey,
    ScanIndexForward: ascending,
    Limit: limit,
  });
  return {
    items: result.Items,
    lastKey: result.LastEvaluatedKey,
  };
};

const getSortedByName = async (hash, ascending, lastKey, limit=36) => {
  const result = await client.query({
    IndexName: 'SortedByName',
    KeyConditionExpression: `#p1 = :hash`,
    ExpressionAttributeValues: {
      ':hash': hash,
    },
    ExpressionAttributeNames: {
      '#p1': FIELDS.HASH,
    },
    ExclusiveStartKey: lastKey,
    ScanIndexForward: ascending,
    Limit: limit,
  });
  return {
    items: result.Items,
    lastKey: result.LastEvaluatedKey,
  };
};

const getSortedByCardCount = async (hash, ascending, lastKey, limit=36) => {
  const result = await client.query({
    IndexName: 'SortedByCardCount',
    KeyConditionExpression: `#p1 = :hash`,
    ExpressionAttributeValues: {
      ':hash': hash,
    },
    ExpressionAttributeNames: {
      '#p1': FIELDS.HASH,
    },
    ExclusiveStartKey: lastKey,
    ScanIndexForward: ascending,
    Limit: limit,
  });
  return {
    items: result.Items,
    lastKey: result.LastEvaluatedKey,
  };
};

module.exports = {
  query: async (hash, ascending, lastKey, order, limit=36) => {
    switch (order) {
      case 'pop':
        return getSortedByFollowers(hash, ascending, lastKey, limit);
      case 'alpha':
        return getSortedByName(hash, ascending, lastKey, limit);
      case 'cards':
        return getSortedByCardCount(hash, ascending, lastKey, limit);
      default:
        return getSortedByFollowers(hash, ascending, lastKey, limit);
    }
  },
  getHashesByCubeId: async (cubeId) => {
    const items = [];
    let lastKey = null;

    do {
       
      const result = await client.query({
        KeyConditionExpression: `#p1 = :cubeId`,
        ExpressionAttributeValues: {
          ':cubeId': cubeId,
        },
        ExpressionAttributeNames: {
          '#p1': FIELDS.CUBE_ID,
        },
        ExclusiveStartKey: lastKey,
      });
      items.push(...result.Items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  },
  getSortedByCardCount,
  getSortedByName,
  getSortedByFollowers,
  batchPut: async (documents) => client.batchPut(documents, true),
  batchDelete: async (keys) => client.batchDelete(keys),
  createTable: async () => client.createTable(),
  getHashRowsForMetadata: (metadata) => {
    const hashes = getHashesForMetadata(metadata);

    return hashes.map((hash) => ({
      [FIELDS.HASH]: hash,
      [FIELDS.NUM_FOLLOWERS]: metadata.following.length,
      [FIELDS.CARD_COUNT]: metadata.cardCount,
      [FIELDS.NAME]: metadata.name,
      [FIELDS.CUBE_ID]: metadata.id,
    }));
  },
  getHashRowsForCube: (metadata, cards) => {
    const hashes = getHashesForCube(metadata, cards);

    return hashes.map((hash) => ({
      [FIELDS.HASH]: hash,
      [FIELDS.NUM_FOLLOWERS]: metadata.following.length,
      [FIELDS.CARD_COUNT]: metadata.cardCount,
      [FIELDS.NAME]: metadata.name,
      [FIELDS.CUBE_ID]: metadata.id,
    }));
  },
  getShortIdHash,
  FIELDS,
};
