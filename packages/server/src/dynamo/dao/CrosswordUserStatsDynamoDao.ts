import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CrosswordUserStats, NewCrosswordUserStats } from '@utils/datatypes/Crossword';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedCrosswordUserStats is the same as CrosswordUserStats since there are no relationships to hydrate.
 */
export interface UnhydratedCrosswordUserStats extends CrosswordUserStats {}

export class CrosswordUserStatsDynamoDao extends BaseDynamoDao<CrosswordUserStats, UnhydratedCrosswordUserStats> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'CROSSWORD_USER_STATS';
  }

  /**
   * One stats item per user.
   */
  protected partitionKey(item: CrosswordUserStats): string {
    return this.typedKey(item.userId);
  }

  protected dehydrateItem(item: CrosswordUserStats): UnhydratedCrosswordUserStats {
    return {
      userId: item.userId,
      currentStreak: item.currentStreak,
      longestStreak: item.longestStreak,
      lastPlayedDate: item.lastPlayedDate,
      totalPlayed: item.totalPlayed,
      totalSolved: item.totalSolved,
      perfectDays: item.perfectDays,
      bestTimeMs: item.bestTimeMs,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedCrosswordUserStats): CrosswordUserStats {
    return item;
  }

  protected async hydrateItems(items: UnhydratedCrosswordUserStats[]): Promise<CrosswordUserStats[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a user's crossword stats.
   */
  public async getByUserId(userId: string): Promise<CrosswordUserStats | undefined> {
    return this.get({
      PK: this.typedKey(userId),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a user's stats item.
   */
  public async createUserStats(document: NewCrosswordUserStats): Promise<CrosswordUserStats> {
    const now = Date.now();
    const item: CrosswordUserStats = {
      ...document,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
