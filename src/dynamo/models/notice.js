const createClient = require('../util');
const User = require('./user');

const FIELDS = {
  ID: 'id',
  DATE: 'date',
  USER: 'user',
  BODY: 'body',
  STATUS: 'status',
  TYPE: 'type',
  SUBJECT: 'subject',
};

const TYPE = {
  APPLICATION: 'a',
  COMMENT_REPORT: 'cr',
  CUBE_REPORT: 'cur',
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

const hydrate = async (notice) => {
  if (!notice) {
    return notice;
  }

  notice.user = await User.getById(notice[FIELDS.USER]);

  return notice;
};

const batchHydrate = async (notices) => {
  const users = await User.batchGet(notices.map((notice) => notice[FIELDS.USER]));

  return notices.map((notice) => {
    notice.user = users.find((user) => user[FIELDS.ID] === notice[FIELDS.USER]);

    return notice;
  });
};

module.exports = {
  getById: async (id) => hydrate((await client.get(id)).Item),
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
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    let userId;
    if (document[FIELDS.USER].id) {
      userId = document[FIELDS.USER].id;
    } else {
      userId = document[FIELDS.USER];
    }

    await client.put({
      [FIELDS.STATUS]: STATUS.ACTIVE,
      ...document,
      [FIELDS.USER]: userId,
    });
  },
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
  STATUS,
  FIELDS,
  TYPE,
};
