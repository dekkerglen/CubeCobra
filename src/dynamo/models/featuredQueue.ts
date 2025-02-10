import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';

import { FeaturedQueueItem, FeaturedQueueStatus, NewFeaturedQueueItem } from '../../datatypes/FeaturedQueue';
import createClient, { QueryInput } from '../util';

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

module.exports = {
  getByCube: async (id: string): Promise<FeaturedQueueItem> => {
    return (await client.get(id)).Item as FeaturedQueueItem;
  },
  put: async (document: NewFeaturedQueueItem): Promise<void> => {
    await client.put({
      ...document,
      status: FeaturedQueueStatus.ACTIVE,
    });
  },
  querySortedByDate: async (
    lastKey?: DocumentClient.Key,
    limit = 36,
  ): Promise<{ items?: FeaturedQueueItem[]; lastKey?: DocumentClient.Key }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const statusAttr: keyof FeaturedQueueItem = 'status';

    const query: QueryInput = {
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
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: FeaturedQueueItem[]; lastKey?: DocumentClient.Key }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const statusAttr: keyof FeaturedQueueItem = 'status';
    const ownerAttr: keyof FeaturedQueueItem = 'owner';

    const query: QueryInput = {
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
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  delete: async (id: string): Promise<void> => client.delete({ cube: id }),
};
