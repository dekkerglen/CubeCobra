import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { ManaMatrixSubmission, NewManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedManaMatrixSubmission is the same as ManaMatrixSubmission since there are no relationships to hydrate.
 */
export interface UnhydratedManaMatrixSubmission extends ManaMatrixSubmission {}

export class ManaMatrixSubmissionDynamoDao extends BaseDynamoDao<ManaMatrixSubmission, UnhydratedManaMatrixSubmission> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'MANAMATRIX_SUBMISSION';
  }

  /**
   * One submission per user per puzzle date.
   */
  protected partitionKey(item: ManaMatrixSubmission): string {
    return this.typedKey(`${item.userId}#${item.date}`);
  }

  /**
   * GSI1: Query a user's submission history, newest first.
   */
  protected GSIKeys(item: ManaMatrixSubmission): {
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

  protected dehydrateItem(item: ManaMatrixSubmission): UnhydratedManaMatrixSubmission {
    return {
      userId: item.userId,
      date: item.date,
      answers: item.answers,
      correct: item.correct,
      attempts: item.attempts,
      countedCells: item.countedCells,
      completedAt: item.completedAt,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedManaMatrixSubmission): ManaMatrixSubmission {
    return item;
  }

  protected async hydrateItems(items: UnhydratedManaMatrixSubmission[]): Promise<ManaMatrixSubmission[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a user's submission for a given puzzle date.
   */
  public async getByUserAndDate(userId: string, date: string): Promise<ManaMatrixSubmission | undefined> {
    return this.get({
      PK: this.typedKey(`${userId}#${date}`),
      SK: this.itemType(),
    });
  }

  /**
   * Gets a user's submission history, ordered by puzzle date descending, with pagination.
   */
  public async getUserHistory(
    userId: string,
    lastKey?: Record<string, any>,
    limit: number = 20,
  ): Promise<{
    items: ManaMatrixSubmission[];
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
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      },
      lastKey,
    );

    return this.query(params);
  }

  /**
   * Creates a user's first submission for a puzzle date.
   */
  public async createSubmission(document: NewManaMatrixSubmission): Promise<ManaMatrixSubmission> {
    const now = Date.now();
    const item: ManaMatrixSubmission = {
      ...document,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
