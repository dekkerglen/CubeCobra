// Migrated to /dao/CardHistoryDynamoDao.ts

import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue, PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import { Period, UnhydratedCardHistory } from '@utils/datatypes/History';
import createClient from 'dynamo/util';

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
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: UnhydratedCardHistory[]; lastKey?: Record<string, NativeAttributeValue> }> => {
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
  scan: async (
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: UnhydratedCardHistory[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });

    return {
      items: result.Items as UnhydratedCardHistory[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: UnhydratedCardHistory): Promise<PutCommandOutput> => {
    return client.put(document);
  },
  batchPut: async (documents: UnhydratedCardHistory[]): Promise<void> => {
    await client.batchPut(documents);
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
};

module.exports = cardhistory;
export default cardhistory;
