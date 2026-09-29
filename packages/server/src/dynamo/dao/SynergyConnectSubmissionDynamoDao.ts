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
   * GSI2: Query every player of one puzzle date — see {@link getAllByDate}.
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
      GSI2PK: `${this.itemType()}#DATE#${item.date}`,
      GSI2SK: `USER#${item.userId}`,
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

  /**
   * Every player's submission for one puzzle date, via GSI2.
   * See ManaMatrixSubmissionDynamoDao.getAllByDate for why GSI2 and what it can't see.
   */
  public async getAllByDate(date: string): Promise<SynergyConnectSubmission[]> {
    const all: SynergyConnectSubmission[] = [];
    let lastKey: Record<string, any> | undefined = undefined;

    do {
      const params: QueryCommandInput = this.buildQueryParams(
        {
          TableName: this.tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :date',
          ExpressionAttributeValues: {
            ':date': `${this.itemType()}#DATE#${date}`,
          },
        },
        lastKey,
      );

      const page = await this.query(params);
      all.push(...page.items);
      lastKey = page.lastKey;
    } while (lastKey);

    return all;
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
