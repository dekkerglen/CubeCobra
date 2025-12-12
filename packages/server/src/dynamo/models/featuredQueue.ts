import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { FeaturedQueueItem, FeaturedQueueStatus, NewFeaturedQueueItem } from '@utils/datatypes/FeaturedQueue';
import createClient, { QueryInputType } from 'dynamo/util';

const client = createClient({
  name: 'FEATURED_QUEUE',
  partitionKey: 'cube',
  indexes: [
    {
      name: 'ByDate',
      partitionKey: 'status',
      sortKey: 'date',
    },
  ],
  attributes: {
    cube: 'S',
    date: 'N',
    status: 'S',
  },
});

export const FeaturedQueue = {
  getByCube: async (id: string): Promise<FeaturedQueueItem | undefined> => {
    const result = await client.get(id);
    return result.Item as FeaturedQueueItem | undefined;
  },
  put: async (document: NewFeaturedQueueItem | FeaturedQueueItem): Promise<void> => {
    const now = Date.now();
    await client.put({
      ...document,
      status: 'status' in document ? document.status : FeaturedQueueStatus.ACTIVE,
      dateCreated: 'dateCreated' in document ? document.dateCreated : now,
      dateLastUpdated: 'dateLastUpdated' in document ? document.dateLastUpdated : now,
    });
  },
  querySortedByDate: async (
    lastKey?: Record<string, NativeAttributeValue>,
    limit = 36,
  ): Promise<{ items?: FeaturedQueueItem[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const statusAttr: keyof FeaturedQueueItem = 'status';

    const query: QueryInputType = {
      IndexName: 'ByDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': statusAttr,
      },
      ExpressionAttributeValues: {
        ':status': FeaturedQueueStatus.ACTIVE,
      },
      Limit: limit,
    };
    if (lastKey) {
      query.ExclusiveStartKey = lastKey;
    }
    const result = await client.query(query);

    return {
      items: result.Items as FeaturedQueueItem[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryWithOwnerFilter: async (
    ownerID: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: FeaturedQueueItem[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const statusAttr: keyof FeaturedQueueItem = 'status';
    const ownerAttr: keyof FeaturedQueueItem = 'owner';

    const query: QueryInputType = {
      IndexName: 'ByDate',
      KeyConditionExpression: '#status = :status',
      FilterExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#status': statusAttr,
        '#owner': ownerAttr,
      },
      ExpressionAttributeValues: {
        ':status': FeaturedQueueStatus.ACTIVE,
        ':owner': ownerID,
      },
    };
    if (lastKey) {
      query.ExclusiveStartKey = lastKey;
    }
    const result = await client.query(query);

    return {
      items: result.Items as FeaturedQueueItem[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchPut: async (documents: FeaturedQueueItem[]): Promise<void> => client.batchPut(documents),
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  delete: async (id: string): Promise<void> => client.delete({ cube: id }),
};
