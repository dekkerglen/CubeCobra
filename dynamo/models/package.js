const uuid = require('uuid/v4');
const createClient = require('../util');
const User = require('./user');
const carddb = require('../../serverjs/carddb');

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
    if (c.id) {
      return c;
    }
    if (c.oracle_id) {
      return carddb.cardFromId(carddb.oracleToId[c.oracle_id][0]);
    }
    return carddb.cardFromId(c)
  });

  return pack;
};

const batchHydrate = async (packs) => {
  const owners = await User.batchGet(packs.map((pack) => pack.owner));

  packs.forEach((pack) => {
    pack.owner = owners.find((owner) => owner.id === pack.owner);
    pack.cards = pack.cards.map((c) => {
      if (c.id) {
        return c;
      }
      if (c.oracle_id) {
        return carddb.cardFromId(carddb.oracleToId[c.oracle_id][0]);
      }
      return carddb.cardFromId(c)
    });
  });

  return packs;
};

module.exports = {
  getById: async (id) => hydrate((await client.get(id)).Item),
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid();

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    if (document.cards) {
      document.cards = document.cards.map((card) => {
        if (card.id) {
          return card.id;
        }

        if (carddb.oracle_id) {
          return carddb.oracleToId[carddb.oracle_id][0];
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
      Limit: 10,
    };

    const result = await client.query(query);

    if (keywords) {
      result.Items = result.Items.filter((item) => item[FIELDS.KEYWORDS].some((keyword) => keywords.includes(keyword)));
    }

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
      Limit: 10,
    };

    const result = await client.query(query);

    if (keywords && keywords.length > 0) {
      result.Items = result.Items.filter((item) => item[FIELDS.KEYWORDS].some((keyword) => keywords.includes(keyword)));
    }

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
      limit: 10,
    };

    const result = await client.query(query);

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
