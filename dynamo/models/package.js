const uuid = require('uuid/v4');
const createClient = require('../util');

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
  ],
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.STATUS]: 'S',
    [FIELDS.VOTECOUNT]: 'N',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid();
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
    };

    const result = await client.query(query);

    if (keywords) {
      result.Items = result.Items.filter((item) => item[FIELDS.KEYWORDS].all((keyword) => keywords.includes(keyword)));
    }

    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
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
  delete: async (id) => client.delete(id),
  FIELDS,
  STATUSES,
};
