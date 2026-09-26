import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { NewSynergyConnectUserStats, SynergyConnectUserStats } from '@utils/datatypes/SynergyConnect';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedSynergyConnectUserStats is the same as SynergyConnectUserStats since there are no relationships to hydrate.
 */
export interface UnhydratedSynergyConnectUserStats extends SynergyConnectUserStats {}

export class SynergyConnectUserStatsDynamoDao extends BaseDynamoDao<
  SynergyConnectUserStats,
  UnhydratedSynergyConnectUserStats
> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'SYNERGY_CONNECT_USER_STATS';
  }

  protected partitionKey(item: SynergyConnectUserStats): string {
    return this.typedKey(item.userId);
  }

  protected dehydrateItem(item: SynergyConnectUserStats): UnhydratedSynergyConnectUserStats {
    return {
      userId: item.userId,
      currentStreak: item.currentStreak,
      longestStreak: item.longestStreak,
      lastPlayedDate: item.lastPlayedDate,
      totalPlayed: item.totalPlayed,
      totalSolved: item.totalSolved,
      perfectDays: item.perfectDays,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedSynergyConnectUserStats): SynergyConnectUserStats {
    return item;
  }

  protected async hydrateItems(items: UnhydratedSynergyConnectUserStats[]): Promise<SynergyConnectUserStats[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  public async getByUserId(userId: string): Promise<SynergyConnectUserStats | undefined> {
    return this.get({
      PK: this.typedKey(userId),
      SK: this.itemType(),
    });
  }

  public async createUserStats(document: NewSynergyConnectUserStats): Promise<SynergyConnectUserStats> {
    const now = Date.now();
    const item: SynergyConnectUserStats = {
      ...document,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
