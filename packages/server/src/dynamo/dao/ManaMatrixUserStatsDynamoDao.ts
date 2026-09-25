import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ManaMatrixUserStats, NewManaMatrixUserStats } from '@utils/datatypes/ManaMatrix';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedManaMatrixUserStats is the same as ManaMatrixUserStats since there are no relationships to hydrate.
 */
export interface UnhydratedManaMatrixUserStats extends ManaMatrixUserStats {}

export class ManaMatrixUserStatsDynamoDao extends BaseDynamoDao<ManaMatrixUserStats, UnhydratedManaMatrixUserStats> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'MANAMATRIX_USER_STATS';
  }

  /**
   * One stats item per user.
   */
  protected partitionKey(item: ManaMatrixUserStats): string {
    return this.typedKey(item.userId);
  }

  protected dehydrateItem(item: ManaMatrixUserStats): UnhydratedManaMatrixUserStats {
    return {
      userId: item.userId,
      currentStreak: item.currentStreak,
      longestStreak: item.longestStreak,
      lastPlayedDate: item.lastPlayedDate,
      totalPlayed: item.totalPlayed,
      totalCellsCorrect: item.totalCellsCorrect,
      perfectDays: item.perfectDays,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedManaMatrixUserStats): ManaMatrixUserStats {
    return item;
  }

  protected async hydrateItems(items: UnhydratedManaMatrixUserStats[]): Promise<ManaMatrixUserStats[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a user's ManaMatrix stats.
   */
  public async getByUserId(userId: string): Promise<ManaMatrixUserStats | undefined> {
    return this.get({
      PK: this.typedKey(userId),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a user's stats item.
   */
  public async createUserStats(document: NewManaMatrixUserStats): Promise<ManaMatrixUserStats> {
    const now = Date.now();
    const item: ManaMatrixUserStats = {
      ...document,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
