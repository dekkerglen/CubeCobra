const uuid = require('uuid');
const createClient = require('../util');
const User = require('./user');
const { cardFromId } = require('../../util/carddb');

const FIELDS = {
  ID: 'id',
  TITLE: 'title',
  DATE: 'date',
  OWNER: 'owner',
  STATUS: 'status',
  CARDS: 'cards',
  VOTERS: 'voters',
  KEYWORDS: 'keywords',
  VOTECOUNT: 'voteCount',
};

const STATUSES = {
  APPROVED: 'a',
  SUBMITTED: 's',
};

const client = createClient({
  name: 'PACKAGE',
  partitionKey: FIELDS.ID,
  indexes: [
    {
      name: 'ByVoteCount',
      partitionKey: FIELDS.STATUS,
      sortKey: FIELDS.VOTECOUNT,
    },
    {
      name: 'ByDate',
      partitionKey: FIELDS.STATUS,
      sortKey: FIELDS.DATE,
    },
    {
      name: 'ByOwner',
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
    },
  ],
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.STATUS]: 'S',
    [FIELDS.VOTECOUNT]: 'N',
    [FIELDS.DATE]: 'N',
    [FIELDS.OWNER]: 'S',
  },
  FIELDS,
});

const hydrate = async (pack) => {
  if (!pack) {
    return pack;
  }

  pack.owner = await User.getById(pack.owner);
  pack.cards = pack.cards.map((c) => {
    if (c.scryfall_id) {
      return c;
    }
    return cardFromId(c);
  });

  return pack;
};

const batchHydrate = async (packs) => {
  const owners = await User.batchGet(packs.map((pack) => pack.owner));

  packs.forEach((pack) => {
    pack.owner = owners.find((owner) => owner.id === pack.owner);
    pack.cards = pack.cards.map((c) => {
      if (c.scryfall_id) {
        return c;
      }
      return cardFromId(c);
    });
  });

  return packs;
};

const applyKeywordFilter = (query /*: Query*/, keywords /*: string*/) => {
  if (!keywords) {
    return query;
  }

  const words = keywords?.toLowerCase()?.split(' ') || [];

  // all words must exist in the keywords
  query.FilterExpression = words.map((word) => `contains(#keywords, :${word})`).join(' and ');

  query.ExpressionAttributeNames = {
    ...query.ExpressionAttributeNames,
    '#keywords': FIELDS.KEYWORDS,
  };

  query.ExpressionAttributeValues = {
    ...query.ExpressionAttributeValues,
    ...words.reduce((acc, word) => {
      acc[`:${word}`] = word;
      return acc;
    }, {}),
  };

  return query;
};

module.exports = {
  getById: async (id) => hydrate((await client.get(id)).Item),
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid.v4();

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    if (document.cards) {
      document.cards = document.cards.map((card) => {
        if (card.scryfall_id) {
          return card.scryfall_id;
        }

        return card;
      });
    }

    await client.put({
      [FIELDS.ID]: id,
      [FIELDS.TITLE]: document[FIELDS.TITLE],
      [FIELDS.DATE]: document[FIELDS.DATE],
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.STATUS]: document[FIELDS.STATUS],
      [FIELDS.CARDS]: document[FIELDS.CARDS],
      [FIELDS.VOTERS]: document[FIELDS.VOTERS],
      [FIELDS.KEYWORDS]: document[FIELDS.KEYWORDS],
      [FIELDS.VOTECOUNT]: document[FIELDS.VOTERS].length,
    });
    return id;
  },
  querySortedByDate: async (status, keywords, ascending, lastKey) => {
    const query = {
      IndexName: 'ByDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': FIELDS.STATUS,
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: 36,
    };

    if (keywords) {
      const words = keywords ? keywords.toLowerCase().split(' ') : null;

      // all words must exist in the keywords
      query.FilterExpression = words.map((word) => `contains(#keywords, :${word})`).join(' and ');

      query.ExpressionAttributeNames = {
        ...query.ExpressionAttributeNames,
        '#keywords': FIELDS.KEYWORDS,
      };

      query.ExpressionAttributeValues = {
        ...query.ExpressionAttributeValues,
        ...words.reduce((acc, word) => {
          acc[`:${word}`] = word;
          return acc;
        }, {}),
      };
    }

    const result = await client.query(query);

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  querySortedByVoteCount: async (status, keywords, ascending, lastKey) => {
    const query = {
      IndexName: 'ByVoteCount',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': FIELDS.STATUS,
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: 36,
    };

    const result = await client.query(applyKeywordFilter(query, keywords));

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryByOwner: async (owner, lastKey) => {
    const query = {
      IndexName: 'ByOwner',
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#owner': FIELDS.OWNER,
      },
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExclusiveStartKey: lastKey,
      Limit: 100, //Higher limit because this function is used to load all packages for a user into memory
    };

    const result = await client.query(query);

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryByOwnerSortedByDate: async (owner, keywords, ascending, lastKey) => {
    //ByOwner secondary index is sorted by Date
    const query = {
      IndexName: 'ByOwner',
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#owner': FIELDS.OWNER,
      },
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: 36,
    };

    const result = await client.query(applyKeywordFilter(query, keywords));

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
  scan: async (lastKey) => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchDelete: async (keys) => {
    client.batchDelete(keys);
  },
  convertPackage: (pack) => {
    return {
      [FIELDS.ID]: `${pack._id}`,
      [FIELDS.TITLE]: pack.title,
      [FIELDS.DATE]: pack.date.valueOf(),
      [FIELDS.OWNER]: `${pack.userid}`,
      [FIELDS.STATUS]: pack.approved ? STATUSES.APPROVED : STATUSES.SUBMITTED,
      [FIELDS.CARDS]: pack.cards,
      [FIELDS.VOTERS]: pack.voters.map((voter) => `${voter}`),
      [FIELDS.KEYWORDS]: pack.keywords,
      [FIELDS.VOTECOUNT]: pack.voters.length,
    };
  },
  delete: async (id) => client.delete({ id }),
  FIELDS,
  STATUSES,
};
