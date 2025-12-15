import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import BlogPost from '@utils/datatypes/BlogPost';
import { Feed, FeedTypes, UnhydratedFeed } from '@utils/datatypes/Feed';

import FeedModel from '../models/feed';
import { BaseDynamoDao } from './BaseDynamoDao';
import { BlogDynamoDao } from './BlogDynamoDao';

// Extended UnhydratedFeed to include BaseObject fields for DAO compatibility
type StoredFeed = UnhydratedFeed & {
  dateCreated: number;
  dateLastUpdated: number;
};

// Extended Feed with metadata for storage
type StoredFeedItem = Feed & {
  to: string;
  dateCreated: number;
  dateLastUpdated: number;
};

export class FeedDynamoDao extends BaseDynamoDao<StoredFeedItem, StoredFeed> {
  private readonly dualWriteEnabled: boolean;
  private readonly blogDao: BlogDynamoDao;

  constructor(
    dynamoClient: DynamoDBDocumentClient,
    blogDao: BlogDynamoDao,
    tableName: string,
    dualWriteEnabled: boolean = false,
  ) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
    this.blogDao = blogDao;
  }

  protected itemType(): string {
    return 'FEED';
  }

  /**
   * Gets the partition key for a feed item.
   * The feed item's id is the same as the document it points to (e.g., BlogPost id)
   */
  protected partitionKey(item: StoredFeedItem): string {
    return this.typedKey(item.document.id);
  }

  /**
   * Gets the sort key for a feed item.
   * Format: FEED#TO#{to}
   */
  protected sortKey(item: StoredFeedItem): string {
    return `${this.itemType()}#TO#${item.to}`;
  }

  /**
   * Gets the GSI keys for the feed item.
   * GSI1: Query by 'to' (user) and date
   */
  protected GSIKeys(item: StoredFeedItem): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    const date = item.document.date;
    return {
      GSI1PK: item.to ? `${this.itemType()}#TO#${item.to}` : undefined,
      GSI1SK: date ? `DATE#${date}` : undefined,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a StoredFeedItem to StoredFeed for storage.
   * Note: Feed contains the full BlogPost, but we only store the reference
   */
  protected dehydrateItem(item: StoredFeedItem): StoredFeed {
    return {
      id: item.document.id,
      to: item.to,
      date: item.document.date,
      type: item.type,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single StoredFeed to StoredFeedItem.
   */
  protected async hydrateItem(item: StoredFeed): Promise<StoredFeedItem> {
    if (item.type === FeedTypes.BLOG) {
      const blogPost = await this.blogDao.getById(item.id);
      if (!blogPost) {
        throw new Error(`Blog post ${item.id} not found for feed item`);
      }
      return {
        type: item.type,
        document: blogPost,
        to: item.to,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
      };
    }

    // Currently only BLOG type is supported, but this allows for extension
    throw new Error(`Unsupported feed type: ${item.type}`);
  }

  /**
   * Hydrates multiple StoredFeeds to StoredFeedItems (optimized batch operation).
   */
  protected async hydrateItems(items: StoredFeed[]): Promise<StoredFeedItem[]> {
    if (items.length === 0) {
      return [];
    }

    // Group feed items by type
    const byType: { [key in FeedTypes]?: string[] } = {};
    items.forEach((item) => {
      const type = item.type;
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(item.id);
    });

    // Fetch all related information for the feed types
    const results = await Promise.all(
      Object.entries(byType).map(async ([type, ids]) => {
        if (type === FeedTypes.BLOG) {
          // Batch get blog posts
          const blogPosts = await Promise.all(ids.map((id) => this.blogDao.getById(id)));
          return blogPosts.filter((post): post is BlogPost => post !== undefined);
        }
        return [];
      }),
    );

    // Organize the BlogPosts into a flat map of BlogPost id to BlogPost
    const itemsById: Record<string, BlogPost> = {};
    results.flat().forEach((item) => {
      if (item) {
        itemsById[item.id] = item;
      }
    });

    // Consolidate the Feed items with the BlogPosts and only return those with a document
    return items
      .map((document) => ({
        type: document.type,
        document: itemsById[document.id],
        to: document.to,
        dateCreated: document.dateCreated,
        dateLastUpdated: document.dateLastUpdated,
      }))
      .filter((item): item is StoredFeedItem => item.document !== undefined);
  }

  /**
   * Gets feed items for a specific user, ordered by date descending, with pagination.
   * This is the main query method for feeds.
   */
  public async getByTo(
    user: string,
    lastKey?: Record<string, any>,
    limit: number = 50,
  ): Promise<{
    items: Feed[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await FeedModel.getByTo(user, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :to',
      ExpressionAttributeValues: {
        ':to': `${this.itemType()}#TO#${user}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    const result = await this.query(params);

    // Convert StoredFeedItem back to Feed for return
    return {
      items: result.items.map((item) => ({
        type: item.type,
        document: item.document,
      })),
      lastKey: result.lastKey,
    };
  }

  /**
   * Batch put feed items from unhydrated feed items.
   * This is the main method to use when adding feed items from the application layer.
   */
  public async batchPutUnhydrated(items: UnhydratedFeed[]): Promise<void> {
    const now = Date.now();

    if (this.dualWriteEnabled) {
      await FeedModel.batchPut(items);
    }

    // Hydrate items to StoredFeedItems for new table
    const storedItems: StoredFeedItem[] = await Promise.all(
      items.map(async (item) => {
        const hydratedItem = await this.hydrateItem({
          ...item,
          dateCreated: now,
          dateLastUpdated: now,
        });
        return hydratedItem;
      }),
    );

    await super.batchPut(storedItems);
  }

  /**
   * Put a single feed item.
   */
  public async putFeedItem(item: UnhydratedFeed): Promise<void> {
    const now = Date.now();

    if (this.dualWriteEnabled) {
      await FeedModel.batchPut([item]);
    }

    const storedItem = await this.hydrateItem({
      ...item,
      dateCreated: now,
      dateLastUpdated: now,
    });

    await super.put(storedItem);
  }

  /**
   * Delete is not typically used for feeds, but included for completeness.
   */
  public async delete(item: StoredFeedItem): Promise<void> {
    if (this.dualWriteEnabled) {
      // Old model doesn't have a delete method for individual feed items
      // We would need to implement this if needed
      console.warn('Delete not implemented in old feed model');
    }

    await super.delete(item);
  }
}
