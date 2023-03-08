// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');

const createClient = require('../util');
const util = require('../../serverjs/util');
const User = require('./user');

const FIELDS = {
  ID: 'id',
  PARENT: 'parent',
  TYPE: 'type',
  OWNER: 'owner',
  BODY: 'body',
  DATE: 'date',
};

const client = createClient({
  name: 'COMMENTS',
  partitionKey: FIELDS.ID,
  indexes: [
    {
      name: 'ByParent',
      partitionKey: FIELDS.PARENT,
      sortKey: FIELDS.DATE,
    },
  ],
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.PARENT]: 'S',
  },
  FIELDS,
});

const hydrate = async (item) => {
  if (!item) return null;

  if (!item.owner) {
    return {
      ...item,
      user: {
        id: '404',
        username: 'Anonymous',
      },
      ImageData: {
        uri: 'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/0/e/0e386888-57f5-4eb6-88e8-5679bb8eb290.jpg?1608910517',
        artist: 'Allan Pollack',
        id: '0c082aa8-bf7f-47f2-baf8-43ad253fd7d7',
      },
    };
  }

  const user = await User.getById(item.owner);
  const ImageData = util.getImageData(user.imageName);

  return {
    ...item,
    user,
    ImageData,
  };
};

module.exports = {
  getById: async (id) => hydrate((await client.get(id)).Item),
  queryByParentAndType: async (parent, lastKey) => {
    const result = await client.query({
      IndexName: 'ByParent',
      KeyConditionExpression: `#p1 = :parent`,
      ExpressionAttributeValues: {
        ':parent': parent,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.PARENT,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: 10,
    });

    return {
      items: await Promise.all(result.Items.map(hydrate)),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    const id = document[FIELDS.ID] || uuid();
    return client.put({
      [FIELDS.ID]: id,
      [FIELDS.DATE]: document.date,
      [FIELDS.BODY]: document.body,
      [FIELDS.OWNER]: document.owner,
      [FIELDS.PARENT]: document.parent,
      [FIELDS.TYPE]: document.type,
    });
  },
  update: async (document) => client.put(document),
  batchPut: async (documents) => {
    await client.batchPut(documents);
  },
  createTable: async () => client.createTable(),
  convertComment: (comment) => {
    return [
      {
        [FIELDS.ID]: `${comment._id}`,
        [FIELDS.OWNER]: `${comment.owner}`,
        [FIELDS.BODY]: comment.content,
        [FIELDS.DATE]: comment.date.valueOf(),
        [FIELDS.PARENT]: `${comment.parent}`,
        [FIELDS.TYPE]: `${comment.parentType}`,
      },
    ];
  },
  FIELDS,
};
