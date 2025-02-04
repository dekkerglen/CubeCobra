import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';

import { Period, UnhydratedCardHistory } from '../../datatypes/History';
import createClient from '../util';

const partitionKey = 'OTComp';

const client = createClient({
  name: 'CARD_HISTORY',
  partitionKey: partitionKey,
  sortKey: 'date',
  attributes: {
    [partitionKey]: 'S',
    date: 'N',
  },
});

const cardhistory = {
  getByOracleAndType: async (
    oracle: string,
    type: Period,
    limit: number,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: UnhydratedCardHistory[]; lastKey?: DocumentClient.Key }> => {
    const result = await client.query({
      KeyConditionExpression: `${partitionKey} = :oracle`,
      ExpressionAttributeValues: {
        ':oracle': `${oracle}:${type}`,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 100,
    });

    return {
      items: result.Items as UnhydratedCardHistory[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: UnhydratedCardHistory): Promise<DocumentClient.PutItemOutput> => {
    return client.put(document);
  },
  batchPut: async (documents: UnhydratedCardHistory[]): Promise<void> => {
    await client.batchPut(documents);
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
};

module.exports = cardhistory;
export default cardhistory;
