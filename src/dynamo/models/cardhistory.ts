import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';

import createClient from '../util';

export enum TYPES {
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day',
}

export enum FIELDS {
  ORACLE_TYPE_COMP = 'OTComp',
  ORACLE_ID = 'oracle',
  DATE = 'date',
  ELO = 'elo',
  PICKS = 'picks',
  SIZE180 = 'size180',
  SIZE360 = 'size360',
  SIZE450 = 'size450',
  SIZE540 = 'size540',
  SIZE720 = 'size720',
  PAUPER = 'pauper',
  PEASANT = 'peasant',
  LEGACY = 'legacy',
  MODERN = 'modern',
  VINTAGE = 'vintage',
  TOTAL = 'total',
}

const client = createClient({
  name: 'CARD_HISTORY',
  partitionKey: FIELDS.ORACLE_TYPE_COMP,
  sortKey: FIELDS.DATE,
  attributes: {
    [FIELDS.ORACLE_TYPE_COMP]: 'S',
    [FIELDS.DATE]: 'N',
  },
});

const cardhistory = {
  getByOracleAndType: async (
    oracle: string,
    type: TYPES,
    limit: number,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: DocumentClient.ItemList; lastKey?: DocumentClient.Key }> => {
    const result = await client.query({
      KeyConditionExpression: `${FIELDS.ORACLE_TYPE_COMP} = :oracle`,
      ExpressionAttributeValues: {
        ':oracle': `${oracle}:${type}`,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 100,
    });

    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: DocumentClient.PutItemInputAttributeMap): Promise<DocumentClient.PutItemOutput> => {
    return client.put(document);
  },
  batchPut: async (documents: DocumentClient.PutItemInputAttributeMap[]): Promise<void> => {
    await client.batchPut(documents);
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  //TODO: Revisit if needed here or exporting above is fine, once everything is using esm imports
  FIELDS,
  TYPES,
};

module.exports = cardhistory;
export default cardhistory;
