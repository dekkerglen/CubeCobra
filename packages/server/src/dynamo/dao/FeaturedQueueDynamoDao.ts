import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { FeaturedQueueItem, FeaturedQueueStatus, NewFeaturedQueueItem } from '@utils/datatypes/FeaturedQueue';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedFeaturedQueueItem is the same as FeaturedQueueItem since there are no complex relationships to hydrate.
 */
export interface UnhydratedFeaturedQueueItem extends FeaturedQueueItem {}

export class FeaturedQueueDynamoDao extends BaseDynamoDao<FeaturedQueueItem, UnhydratedFeaturedQueueItem> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'FEATURED_QUEUE';
  }

  /**
   * Gets the partition key for a featured queue item.
   * Uses the cube ID as the partition key.
   */
  protected partitionKey(item: FeaturedQueueItem): string {
    return this.typedKey(item.cube);
  }

  /**
   * Gets the GSI keys for the featured queue item.
   * GSI1: Query by status and date (for sorted by date queries)
   */
  protected GSIKeys(item: FeaturedQueueItem): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    return {
      GSI1PK: `${this.itemType()}#STATUS#${item.status}`,
      GSI1SK: `DATE#${item.date}`,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a FeaturedQueueItem to UnhydratedFeaturedQueueItem for storage.
   */
  protected dehydrateItem(item: FeaturedQueueItem): UnhydratedFeaturedQueueItem {
    return {
      cube: item.cube,
      date: item.date,
      owner: item.owner,
      featuredOn: item.featuredOn,
      status: item.status,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedFeaturedQueueItem to FeaturedQueueItem.
   * Since there are no relationships to hydrate, this is a simple pass-through.
   */
  protected hydrateItem(item: UnhydratedFeaturedQueueItem): FeaturedQueueItem {
    return {
      cube: item.cube,
      date: item.date,
      owner: item.owner,
      featuredOn: item.featuredOn,
      status: item.status,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates multiple UnhydratedFeaturedQueueItems to FeaturedQueueItems.
   */
  protected async hydrateItems(items: UnhydratedFeaturedQueueItem[]): Promise<FeaturedQueueItem[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a featured queue item by cube ID.
   */
  public async getByCube(id: string): Promise<FeaturedQueueItem | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a new featured queue item with active status.
   */
  public async createFeaturedQueueItem(document: NewFeaturedQueueItem): Promise<void> {
    const now = Date.now();
    const item: FeaturedQueueItem = {
      ...document,
      status: FeaturedQueueStatus.ACTIVE,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
  }

  /**
   * Queries featured queue items sorted by date, with pagination.
   * Only returns items with ACTIVE status.
   */
  public async querySortedByDate(
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: FeaturedQueueItem[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :status',
      ExpressionAttributeValues: {
        ':status': `${this.itemType()}#STATUS#${FeaturedQueueStatus.ACTIVE}`,
      },
      ScanIndexForward: true, // Ascending order by date
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries featured queue items filtered by owner ID.
   * Only returns items with ACTIVE status.
   */
  public async queryWithOwnerFilter(
    ownerID: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: FeaturedQueueItem[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :status',
      FilterExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#owner': 'owner',
      },
      ExpressionAttributeValues: {
        ':status': `${this.itemType()}#STATUS#${FeaturedQueueStatus.ACTIVE}`,
        ':owner': ownerID,
      },
      ScanIndexForward: true, // Ascending order by date
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: FeaturedQueueItem): Promise<void> {
    await super.put(item);
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: FeaturedQueueItem): Promise<void> {
    await super.update(item);
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: FeaturedQueueItem): Promise<void> {
    await super.delete(item);
  }

  /**
   * Batch puts multiple featured queue items.
   */
  public async batchPut(items: FeaturedQueueItem[]): Promise<void> {
    await super.batchPut(items);
  }
}
