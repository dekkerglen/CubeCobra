// migrated to /daos/FeedDynamoDao.ts

import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import BlogPost from '@utils/datatypes/BlogPost';
import { Feed, FeedTypes, UnhydratedFeed } from '@utils/datatypes/Feed';
import createClient from 'dynamo/util';

import Blog from './blog';

const client = createClient({
  name: 'FEED',
  partitionKey: 'id',
  sortKey: 'to',
  indexes: [
    {
      name: 'ByTo',
      partitionKey: 'to',
      sortKey: 'date',
    },
  ],
  attributes: {
    id: 'S',
    to: 'S',
    date: 'N',
  },
});

const feed = {
  batchPut: async (documents: UnhydratedFeed[]): Promise<void> => client.batchPut(documents),
  getByTo: async (
    user: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: Feed[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const toAttr: keyof UnhydratedFeed = 'to';

    const result = await client.query({
      IndexName: 'ByTo',
      KeyConditionExpression: '#to = :to',
      ExpressionAttributeNames: {
        '#to': toAttr,
      },
      ExpressionAttributeValues: {
        ':to': user,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    if (!result.Items) {
      return {
        items: [],
        lastKey: result.LastEvaluatedKey,
      };
    }

    const items = result.Items as UnhydratedFeed[];

    //Using [key in FeedTypes]? as unlike Record<FeedTypes, ..> it doesn't require the initial object to have all keys set
    const byType: { [key in FeedTypes]?: string[] } = {};
    //Group the Feed items by type
    items.forEach((item) => {
      const type = item.type;
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(item.id);
    });

    //Fetch all related information for the feed types
    const results = await Promise.all(
      Object.entries(byType).map(async ([type, ids]) => {
        if (type === FeedTypes.BLOG) {
          return Blog.batchGet(ids);
        }
        return [];
      }),
    );

    // organize the BlogPosts into a flat map of BlogPost id to BlogPost
    const itemsById: Record<string, BlogPost> = {};
    results.flat().forEach((item) => {
      if (item) {
        itemsById[item.id] = item;
      }
    });

    //Consolidate the Feed items with the BlogPosts and only return those with a document
    return {
      items: items
        .map((document) => ({
          type: document.type,
          document: itemsById[document.id],
        }))
        .filter((item): item is { type: any; document: BlogPost } => item.document !== undefined),
      lastKey: result.LastEvaluatedKey,
    };
  },
  scan: async (
    limit?: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items: UnhydratedFeed[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      Limit: limit,
    });

    return {
      items: (result.Items ?? []) as UnhydratedFeed[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
};

module.exports = feed;

export default feed;
