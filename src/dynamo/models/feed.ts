import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';

import BlogPost from '../../datatypes/BlogPost';
import { Feed, FeedTypes, UnhydratedFeed } from '../../datatypes/Feed';
import createClient from '../util';
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
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Feed[]; lastKey?: DocumentClient.Key }> => {
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
        .filter((item) => item.document),
      lastKey: result.LastEvaluatedKey,
    };
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
};

module.exports = feed;

export default feed;
