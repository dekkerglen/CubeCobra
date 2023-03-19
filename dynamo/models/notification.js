const uuid = require('uuid/v4');
const createClient = require('../util');

const FIELDS = {
  ID: 'id',
  DATE: 'date',
  TO: 'to',
  FROM: 'from',
  URL: 'url',
  BODY: 'body',
  STATUS: 'status',
  FROM_USERNAME: 'fromUsername',
  TO_STATUS_COMP: 'toStatusComp',
};

const STATUS = {
  READ: 'r',
  UNREAD: 'u',
};

const client = createClient({
  name: 'NOTIFICATIONS',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.TO_STATUS_COMP]: 'S',
    [FIELDS.TO]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.TO,
      sortKey: FIELDS.DATE,
      name: 'ByTo',
    },
    {
      partitionKey: FIELDS.TO_STATUS_COMP,
      sortKey: FIELDS.DATE,
      name: 'ByToStatusComp',
    },
  ],
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  getByToAndStatus: async (to, status, lastKey) => {
    const result = await client.query({
      IndexName: 'ByToStatusComp',
      KeyConditionExpression: `#p1 = :tscomp`,
      ExpressionAttributeValues: {
        ':tscomp': `${to}:${status}`,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.TO_STATUS_COMP,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByTo: async (to, lastKey) => {
    const result = await client.query({
      IndexName: 'ByTo',
      KeyConditionExpression: `#p1 = :to`,
      ExpressionAttributeValues: {
        ':to': `${to}`,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.TO,
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
    document[FIELDS.TO_STATUS_COMP] = `${document.to}:${document.status}`;
    return client.put(document);
  },
  put: async (document) =>
    client.put({
      [FIELDS.TO_STATUS_COMP]: `${document.to}:${STATUS.UNREAD}`,
      [FIELDS.STATUS]: STATUS.UNREAD,
      ...document,
    }),
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
  getNotificationsFromUser: (user) => {
    const notifications = [
      ...user.notifications.map((item) => ({ [FIELDS.STATUS]: STATUS.UNREAD, ...item })),
      ...user.old_notifications.map((item) => ({ [FIELDS.STATUS]: STATUS.READ, ...item })),
    ];

    return notifications.map((item) => ({
      [FIELDS.ID]: uuid(),
      [FIELDS.DATE]: item.date.valueOf(),
      [FIELDS.TO]: `${user._id}`,
      [FIELDS.FROM]: `${item.user_from}`,
      [FIELDS.FROM_USERNAME]: item.user_from_name,
      [FIELDS.URL]: item.url,
      [FIELDS.BODY]: item.text,
      [FIELDS.STATUS]: item[FIELDS.STATUS],
      [FIELDS.TO_STATUS_COMP]: `${user._id}:${item[FIELDS.STATUS]}`,
    }));
  },
  STATUS,
  FIELDS,
};
