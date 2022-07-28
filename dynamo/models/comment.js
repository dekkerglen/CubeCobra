// dotenv
require('dotenv').config();

const createClient = require('../util');

const FIELDS = {
  PPT_COMP: 'PPTComp',
  OWNER: 'Owner',
  BODY: 'Body',
  DATE: 'Date',
};

const client = createClient({
  name: 'COMMENTS',
  partitionKey: FIELDS.PPT_COMP,
  sortKey: FIELDS.DATE,
  attributes: {
    [FIELDS.PPT_COMP]: 'S',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

module.exports = {
  queryByParentAndType: async (parent, type, lastKey) => {
    const pptComp = `${parent}:${type}`;
    const res = await client.query({
      KeyConditionExpression: '#pptComp = :pptComp',
      ExpressionAttributeNames: {
        '#pptComp': FIELDS.PPT_COMP,
      },
      ExpressionAttributeValues: {
        ':pptComp': pptComp,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: res.Items,
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    return client.put({
      [FIELDS.PPT_COMP]: `${document.Parent}:${document.ParentType}`,
      [FIELDS.DATE]: document.Date,
      [FIELDS.BODY]: document.Body,
      [FIELDS.OWNER]: document.Owner,
    });
  },
  batchPut: async (documents) => {
    await client.batchPut(documents);
  },
  createTable: async () => client.createTable(),
  convertComment: (comment) => {
    return [
      {
        [FIELDS.OWNER]: `${comment.owner}`,
        [FIELDS.BODY]: comment.content,
        [FIELDS.DATE]: comment.date.valueOf(),
        [FIELDS.PPT_COMP]: `${comment.parent}:${comment.parentType}`,
      },
    ];
  },
  FIELDS,
};
