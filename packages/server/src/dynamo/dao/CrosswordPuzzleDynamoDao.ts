import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { CrosswordPuzzle, NewCrosswordPuzzle } from '@utils/datatypes/Crossword';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedCrosswordPuzzle is the same as CrosswordPuzzle since there are no relationships to hydrate.
 */
export interface UnhydratedCrosswordPuzzle extends CrosswordPuzzle {}

export class CrosswordPuzzleDynamoDao extends BaseDynamoDao<CrosswordPuzzle, UnhydratedCrosswordPuzzle> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'CROSSWORD_PUZZLE';
  }

  /**
   * Puzzles are keyed by their date (YYYY-MM-DD), one per day.
   */
  protected partitionKey(item: CrosswordPuzzle): string {
    return this.typedKey(item.id);
  }

  /**
   * GSI1: Query by type and date (for the archive, newest first)
   * GSI2: Query by isActive status (for getting the current daily puzzle)
   */
  protected GSIKeys(item: CrosswordPuzzle): {
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

  protected dehydrateItem(item: CrosswordPuzzle): UnhydratedCrosswordPuzzle {
    return {
      id: item.id,
      type: item.type,
      date: item.date,
      grid: item.grid,
      isActive: item.isActive,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedCrosswordPuzzle): CrosswordPuzzle {
    return item;
  }

  protected async hydrateItems(items: UnhydratedCrosswordPuzzle[]): Promise<CrosswordPuzzle[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a puzzle by its date (YYYY-MM-DD).
   */
  public async getByDate(date: string): Promise<CrosswordPuzzle | undefined> {
    return this.get({
      PK: this.typedKey(date),
      SK: this.itemType(),
    });
  }

  /**
   * Gets the currently active daily puzzle.
   */
  public async getActive(): Promise<CrosswordPuzzle | undefined> {
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
   * Gets the history of puzzles, ordered by date descending, with pagination.
   */
  public async getHistory(
    lastKey?: Record<string, any>,
    limit: number = 20,
  ): Promise<{
    items: CrosswordPuzzle[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = this.buildQueryParams(
      {
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :type',
        ExpressionAttributeValues: {
          ':type': `${this.itemType()}#TYPE#HISTORY`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      },
      lastKey,
    );

    return this.query(params);
  }

  /**
   * Creates and activates the puzzle for its date, deactivating the previous
   * active puzzle.
   */
  public async setActivePuzzle(document: NewCrosswordPuzzle): Promise<CrosswordPuzzle> {
    const current = await this.getActive();
    if (current && current.date !== document.date) {
      const updatedCurrent: CrosswordPuzzle = {
        ...current,
        isActive: false,
        dateLastUpdated: Date.now(),
      };
      await this.update(updatedCurrent);
    }

    const now = Date.now();
    const item: CrosswordPuzzle = {
      ...document,
      id: document.date,
      type: 'HISTORY',
      isActive: true,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(item);
    return item;
  }
}
