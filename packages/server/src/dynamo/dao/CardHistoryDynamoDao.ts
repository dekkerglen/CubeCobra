import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import History, { Period, UnhydratedCardHistory } from '@utils/datatypes/History';

import CardHistoryModel from '../models/cardhistory';
import { BaseDynamoDao } from './BaseDynamoDao';

export class CardHistoryDynamoDao extends BaseDynamoDao<History, UnhydratedCardHistory> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'CARDHISTORY';
  }

  /**
   * Gets the partition key for a card history entry.
   * Format: "CARDHISTORY#{oracle}:{type}"
   */
  protected partitionKey(item: History): string {
    // Extract oracle and type from OTComp if not directly available
    const [oracle, type] = item.OTComp.split(':');
    return this.typedKey(`${oracle}:${type}`);
  }

  /**
   * Gets the sort key for a card history entry.
   * Sort by date descending.
   */
  protected sortKey(item: History): string {
    return `DATE#${item.date}`;
  }

  /**
   * Gets the GSI keys for the card history entry.
   * GSI1: Query by oracle only (across all periods)
   * GSI2: Query by date (for time-based queries)
   */
  protected GSIKeys(item: History): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    const [oracle] = item.OTComp.split(':');
    return {
      GSI1PK: oracle ? `${this.itemType()}#ORACLE#${oracle}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: `${this.itemType()}#BYDATE`,
      GSI2SK: item.date ? `DATE#${item.date}` : undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a History to UnhydratedCardHistory for storage.
   */
  protected dehydrateItem(item: History): UnhydratedCardHistory {
    const unhydrated: UnhydratedCardHistory = {
      OTComp: item.OTComp,
      oracle: item.oracle,
      date: item.date,
      picks: item.picks,
      legacy: item.legacy,
      modern: item.modern,
      pauper: item.pauper,
      vintage: item.vintage,
      peasant: item.peasant,
      size180: item.size180,
      size360: item.size360,
      size450: item.size450,
      size540: item.size540,
      size720: item.size720,
      cubeCount: item.cubeCount,
      total: item.total,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };

    if (item.elo !== undefined) {
      unhydrated.elo = item.elo;
    }

    return unhydrated;
  }

  /**
   * Hydrates a single UnhydratedCardHistory to History.
   */
  protected hydrateItem(item: UnhydratedCardHistory): History {
    return {
      ...item,
      cubes: this.calculateCubes(item),
    };
  }

  /**
   * Hydrates multiple UnhydratedCardHistory items to History items.
   */
  protected async hydrateItems(items: UnhydratedCardHistory[]): Promise<History[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Calculates the number of cubes from the card history data.
   * This is derived data based on the cube type counts.
   */
  private calculateCubes(item: UnhydratedCardHistory): number {
    // Sum up all the cube type counts
    let total = 0;
    const cubeTypes = [
      'legacy',
      'modern',
      'pauper',
      'vintage',
      'peasant',
      'size180',
      'size360',
      'size450',
      'size540',
      'size720',
    ] as const;

    for (const type of cubeTypes) {
      const value = item[type];
      if (value && Array.isArray(value) && value.length > 0) {
        total += value[0]; // First element is the count
      }
    }

    return total;
  }

  /**
   * Gets card history by oracle ID and period type.
   */
  public async queryByOracleAndType(
    oracle: string,
    type: Period,
    limit: number = 100,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: History[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await CardHistoryModel.getByOracleAndType(oracle, type, limit, lastKey);
      const items = result.items || [];
      return {
        items: await this.hydrateItems(items),
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': this.typedKey(`${oracle}:${type}`),
      },
      ScanIndexForward: false, // Sort by date descending
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries all history entries for an oracle ID across all periods.
   */
  public async queryByOracle(
    oracle: string,
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<{
    items: History[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :oracle',
      ExpressionAttributeValues: {
        ':oracle': `${this.itemType()}#ORACLE#${oracle}`,
      },
      ScanIndexForward: false, // Sort by date descending
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries card history entries by date range.
   */
  public async queryByDateRange(
    startDate: number,
    endDate?: number,
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<{
    items: History[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: endDate
        ? 'GSI2PK = :pk AND GSI2SK BETWEEN :startDate AND :endDate'
        : 'GSI2PK = :pk AND GSI2SK >= :startDate',
      ExpressionAttributeValues: endDate
        ? {
            ':pk': `${this.itemType()}#BYDATE`,
            ':startDate': `DATE#${startDate}`,
            ':endDate': `DATE#${endDate}`,
          }
        : {
            ':pk': `${this.itemType()}#BYDATE`,
            ':startDate': `DATE#${startDate}`,
          },
      ScanIndexForward: false, // Sort by date descending
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: History): Promise<void> {
    if (this.dualWriteEnabled) {
      const unhydrated = this.dehydrateItem(item);
      await Promise.all([CardHistoryModel.put(unhydrated), super.put(item)]);
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides batchPut to support dual writes.
   */
  public async batchPut(items: History[]): Promise<void> {
    if (this.dualWriteEnabled) {
      const unhydrated = items.map((item) => this.dehydrateItem(item));
      await Promise.all([CardHistoryModel.batchPut(unhydrated), super.batchPut(items)]);
    } else {
      await super.batchPut(items);
    }
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: History): Promise<void> {
    if (this.dualWriteEnabled) {
      const unhydrated = this.dehydrateItem(item);
      await Promise.all([
        CardHistoryModel.put(unhydrated), // Old model doesn't have separate update
        super.update(item),
      ]);
    } else {
      await super.update(item);
    }
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: History): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      // Note: Old model doesn't have a delete method, so we skip it
      await super.delete(item);
    } else {
      await super.delete(item);
    }
  }
}
