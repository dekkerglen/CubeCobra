// migrated to /daos/RecordDynamoDao.ts

import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import RecordType from '@utils/datatypes/Record';
import createClient from 'dynamo/util';
import { v4 as uuidv4 } from 'uuid';

const client = createClient({
  name: 'RECORD',
  partitionKey: 'id',
  attributes: {
    cube: 'S',
    date: 'N',
    id: 'S',
  },
  indexes: [
    {
      name: 'ByCube',
      partitionKey: 'cube',
      sortKey: 'date',
    },
  ],
});

const fillRequiredDetails = (document: RecordType): RecordType => {
  return {
    id: document.id || uuidv4(),
    cube: document.cube,
    date: document.date || Date.now().valueOf(),
    name: document.name,
    description: document.description || '',
    players: document.players || [],
    matches: document.matches || [],
    trophy: document.trophy || '',
    draft: document.draft,
  };
};

const record = {
  getById: async (id: string): Promise<RecordType | undefined> => (await client.get(id)).Item as RecordType,
  getByCube: async (
    cube: string,
    limit: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: RecordType[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const cubeAttr: keyof RecordType = 'cube';

    const result = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: `#p1 = :cube`,
      ExpressionAttributeValues: {
        ':cube': cube,
      },
      ExpressionAttributeNames: {
        '#p1': cubeAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 36,
    });
    return {
      items: result.Items as RecordType[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: RecordType): Promise<string> => {
    const filled = fillRequiredDetails(document);
    client.put(filled);

    return filled.id!;
  },
  delete: async (id: string): Promise<void> => {
    await client.delete({ id });
  },
  scan: async (
    limit?: number,
    lastKey?: Record<string, any>,
  ): Promise<{ items: any[]; lastKey?: Record<string, any> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      Limit: limit,
    });

    return {
      items: result.Items ?? [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
};

module.exports = record;
export default record;
