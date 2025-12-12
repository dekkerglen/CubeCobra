import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { DailyP1P1, NewDailyP1P1 } from '@utils/datatypes/DailyP1P1';
import { v4 as uuidv4 } from 'uuid';

import dailyP1P1Model from '../models/dailyP1P1';
import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedDailyP1P1 is the same as DailyP1P1 since there are no complex relationships to hydrate.
 */
export interface UnhydratedDailyP1P1 extends DailyP1P1 {}

export class DailyP1P1DynamoDao extends BaseDynamoDao<DailyP1P1, UnhydratedDailyP1P1> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'DAILY_P1P1';
  }

  /**
   * Gets the partition key for a daily P1P1.
   */
  protected partitionKey(item: DailyP1P1): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the daily P1P1.
   * GSI1: Query by type and date (for history queries)
   * GSI2: Query by isActive status (for getting current active P1P1)
   */
  protected GSIKeys(item: DailyP1P1): {
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
      GSI1PK: `${this.itemType()}#TYPE#${item.type}`,
      GSI1SK: `DATE#${item.date}`,
      GSI2PK: item.isActive ? `${this.itemType()}#ACTIVE` : undefined,
      GSI2SK: item.isActive ? `DATE#${item.date}` : undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a DailyP1P1 to UnhydratedDailyP1P1 for storage.
   */
  protected dehydrateItem(item: DailyP1P1): UnhydratedDailyP1P1 {
    return {
      id: item.id,
      type: item.type,
      packId: item.packId,
      cubeId: item.cubeId,
      date: item.date,
      isActive: item.isActive,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedDailyP1P1 to DailyP1P1.
   * Since there are no relationships to hydrate, this is a simple pass-through.
   */
  protected hydrateItem(item: UnhydratedDailyP1P1): DailyP1P1 {
    return {
      id: item.id,
      type: item.type,
      packId: item.packId,
      cubeId: item.cubeId,
      date: item.date,
      isActive: item.isActive,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates multiple UnhydratedDailyP1P1s to DailyP1P1s.
   */
  protected async hydrateItems(items: UnhydratedDailyP1P1[]): Promise<DailyP1P1[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a daily P1P1 by ID.
   */
  public async getById(id: string): Promise<DailyP1P1 | undefined> {
    if (this.dualWriteEnabled) {
      const result = await dailyP1P1Model.getById(id);
      return result || undefined;
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Gets the currently active daily P1P1.
   */
  public async getCurrentDailyP1P1(): Promise<DailyP1P1 | undefined> {
    if (this.dualWriteEnabled) {
      const result = await dailyP1P1Model.getCurrentDailyP1P1();
      return result || undefined;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :active',
      ExpressionAttributeValues: {
        ':active': `${this.itemType()}#ACTIVE`,
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1,
    };

    const result = await this.query(params);
    return result.items.length > 0 ? result.items[0] : undefined;
  }

  /**
   * Gets the history of daily P1P1s, ordered by date descending, with pagination.
   */
  public async getDailyP1P1History(
    lastKey?: Record<string, any>,
    limit: number = 20,
  ): Promise<{
    items: DailyP1P1[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await dailyP1P1Model.getDailyP1P1History(lastKey, limit);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :type',
      ExpressionAttributeValues: {
        ':type': `${this.itemType()}#TYPE#HISTORY`,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Creates a new daily P1P1 entry.
   */
  public async createDailyP1P1(document: NewDailyP1P1): Promise<DailyP1P1> {
    const id = uuidv4();
    const now = Date.now();
    const item: DailyP1P1 = {
      ...document,
      id,
      type: 'HISTORY',
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }

  /**
   * Sets a new active daily P1P1, deactivating the current one.
   */
  public async setActiveDailyP1P1(packId: string, cubeId: string): Promise<DailyP1P1> {
    // First, deactivate current daily P1P1
    const current = await this.getCurrentDailyP1P1();
    if (current) {
      // Update the current one to be inactive
      const updatedCurrent: DailyP1P1 = {
        ...current,
        isActive: false,
        dateLastUpdated: Date.now(),
      };
      await this.update(updatedCurrent);
    }

    // Create new active daily P1P1
    // Add 6 hours to the current time to account for lambda running at 2:55 UTC
    // This makes the date appear as the current day for most users
    return await this.createDailyP1P1({
      packId,
      cubeId,
      date: Date.now() + 6 * 60 * 60 * 1000,
      isActive: true,
    });
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: DailyP1P1): Promise<void> {
    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([dailyP1P1Model.put(item), super.put(item)]);
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: DailyP1P1): Promise<void> {
    if (this.dualWriteEnabled) {
      // Check if item exists in new table first
      const existsInNewTable = await this.get({
        PK: this.partitionKey(item),
        SK: this.itemType(),
      });

      // Write to both old and new paths
      // If item doesn't exist in new table yet, use put instead of update
      await Promise.all([dailyP1P1Model.update(item), existsInNewTable ? super.update(item) : super.put(item)]);
    } else {
      await super.update(item);
    }
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: DailyP1P1): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      await Promise.all([dailyP1P1Model.delete(item.id), super.delete(item)]);
    } else {
      await super.delete(item);
    }
  }
}
