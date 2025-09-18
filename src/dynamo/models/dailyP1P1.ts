import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import { DailyP1P1, NewDailyP1P1 } from '../../datatypes/DailyP1P1';
import createClient from '../util';

const client = createClient({
  name: 'DAILY_P1P1',
  partitionKey: 'id',
  indexes: [
    {
      name: 'ByDate',
      partitionKey: 'isActive',
      sortKey: 'date',
    },
  ],
  attributes: {
    id: 'S',
    date: 'N',
    isActive: 'S', // 'true' for active, 'false' for inactive
  },
});

const dailyP1P1 = {
  getById: async (id: string): Promise<DailyP1P1 | null> => {
    const result = await client.get(id);
    return result.Item as DailyP1P1 || null;
  },

  getCurrentDailyP1P1: async (): Promise<DailyP1P1 | null> => {
    const result = await client.query({
      IndexName: 'ByDate',
      KeyConditionExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': 'true',
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1,
    });

    return result.Items?.[0] as DailyP1P1 || null;
  },

  getDailyP1P1History: async (
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 20,
  ): Promise<{
    items?: DailyP1P1[];
    lastKey?: Record<string, NativeAttributeValue>;
  }> => {
    const result = await client.query({
      IndexName: 'ByDate',
      KeyConditionExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': 'false',
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });

    return {
      items: result.Items as DailyP1P1[],
      lastKey: result.LastEvaluatedKey,
    };
  },

  put: async (document: NewDailyP1P1): Promise<DailyP1P1> => {
    const id = uuidv4();
    const item: DailyP1P1 = {
      ...document,
      id,
      isActive: document.isActive,
    };

    await client.put({
      ...item,
      isActive: item.isActive.toString(), // Convert boolean to string for DynamoDB
    });

    return item;
  },

  setActiveDailyP1P1: async (packId: string, cubeId: string): Promise<DailyP1P1> => {
    // First, deactivate current daily P1P1
    const current = await dailyP1P1.getCurrentDailyP1P1();
    if (current) {
      await client.update({
        Key: { id: current.id },
        UpdateExpression: 'SET isActive = :inactive',
        ExpressionAttributeValues: {
          ':inactive': 'false',
        },
      });
    }

    // Create new active daily P1P1
    return await dailyP1P1.put({
      packId,
      cubeId,
      date: Date.now(),
      isActive: true,
    });
  },

  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),

  delete: async (id: string): Promise<void> => {
    await client.delete({ id });
  },
};

export default dailyP1P1;