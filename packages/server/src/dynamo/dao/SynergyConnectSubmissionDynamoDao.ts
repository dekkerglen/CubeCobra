import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { NewSynergyConnectSubmission, SynergyConnectSubmission } from '@utils/datatypes/SynergyConnect';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedSynergyConnectSubmission is the same as SynergyConnectSubmission since there are no relationships to hydrate.
 */
export interface UnhydratedSynergyConnectSubmission extends SynergyConnectSubmission {}

export class SynergyConnectSubmissionDynamoDao extends BaseDynamoDao<
  SynergyConnectSubmission,
  UnhydratedSynergyConnectSubmission
> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'SYNERGY_CONNECT_SUBMISSION';
  }

  /**
   * One submission per user per puzzle date.
   */
  protected partitionKey(item: SynergyConnectSubmission): string {
    return this.typedKey(`${item.userId}#${item.date}`);
  }

  /**
   * GSI1: Query a user's submission history, newest first.
   */
  protected GSIKeys(item: SynergyConnectSubmission): {
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
      GSI1PK: `${this.itemType()}#USER#${item.userId}`,
      GSI1SK: `DATE#${item.date}`,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  protected dehydrateItem(item: SynergyConnectSubmission): UnhydratedSynergyConnectSubmission {
    return {
      userId: item.userId,
      date: item.date,
      solvedGroups: item.solvedGroups,
      guesses: item.guesses,
      mistakes: item.mistakes,
      completedAt: item.completedAt,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedSynergyConnectSubmission): SynergyConnectSubmission {
    return item;
  }

  protected async hydrateItems(items: UnhydratedSynergyConnectSubmission[]): Promise<SynergyConnectSubmission[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  public async getByUserAndDate(userId: string, date: string): Promise<SynergyConnectSubmission | undefined> {
    return this.get({
      PK: this.typedKey(`${userId}#${date}`),
      SK: this.itemType(),
    });
  }

  public async getUserHistory(
    userId: string,
    lastKey?: Record<string, any>,
    limit: number = 20,
  ): Promise<{
    items: SynergyConnectSubmission[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = this.buildQueryParams(
      {
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :user',
        ExpressionAttributeValues: {
          ':user': `${this.itemType()}#USER#${userId}`,
        },
        ScanIndexForward: false,
        Limit: limit,
      },
      lastKey,
    );

    return this.query(params);
  }

  public async createSubmission(document: NewSynergyConnectSubmission): Promise<SynergyConnectSubmission> {
    const now = Date.now();
    const item: SynergyConnectSubmission = {
      ...document,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
