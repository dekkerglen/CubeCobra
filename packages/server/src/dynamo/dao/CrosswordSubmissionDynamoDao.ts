import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { CrosswordSubmission, NewCrosswordSubmission } from '@utils/datatypes/Crossword';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedCrosswordSubmission is the same as CrosswordSubmission since there are no relationships to hydrate.
 */
export interface UnhydratedCrosswordSubmission extends CrosswordSubmission {}

export class CrosswordSubmissionDynamoDao extends BaseDynamoDao<CrosswordSubmission, UnhydratedCrosswordSubmission> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'CROSSWORD_SUBMISSION';
  }

  /**
   * One submission per user per puzzle date.
   */
  protected partitionKey(item: CrosswordSubmission): string {
    return this.typedKey(`${item.userId}#${item.date}`);
  }

  /**
   * GSI1: Query a user's submission history, newest first.
   */
  protected GSIKeys(item: CrosswordSubmission): {
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

  protected dehydrateItem(item: CrosswordSubmission): UnhydratedCrosswordSubmission {
    return {
      userId: item.userId,
      date: item.date,
      startedAt: item.startedAt,
      attempts: item.attempts,
      checks: item.checks,
      reveals: item.reveals,
      solved: item.solved,
      completionTimeMs: item.completionTimeMs,
      completedAt: item.completedAt,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedCrosswordSubmission): CrosswordSubmission {
    return item;
  }

  protected async hydrateItems(items: UnhydratedCrosswordSubmission[]): Promise<CrosswordSubmission[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a user's submission for a given puzzle date.
   */
  public async getByUserAndDate(userId: string, date: string): Promise<CrosswordSubmission | undefined> {
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
    items: CrosswordSubmission[];
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
   * Creates a user's submission for a puzzle date. Happens when they first open
   * the puzzle, since that is when the clock starts.
   */
  public async createSubmission(document: NewCrosswordSubmission): Promise<CrosswordSubmission> {
    const now = Date.now();
    const item: CrosswordSubmission = {
      ...document,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
