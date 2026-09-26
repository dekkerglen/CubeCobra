import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { NewSynergyConnectPuzzle, SynergyConnectPuzzle } from '@utils/datatypes/SynergyConnect';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedSynergyConnectPuzzle is the same as SynergyConnectPuzzle since there are no relationships to hydrate.
 */
export interface UnhydratedSynergyConnectPuzzle extends SynergyConnectPuzzle {}

export class SynergyConnectPuzzleDynamoDao extends BaseDynamoDao<SynergyConnectPuzzle, UnhydratedSynergyConnectPuzzle> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'SYNERGY_CONNECT_PUZZLE';
  }

  /**
   * Puzzles are keyed by their date (YYYY-MM-DD), one per day.
   */
  protected partitionKey(item: SynergyConnectPuzzle): string {
    return this.typedKey(item.id);
  }

  /**
   * GSI1: Query by type and date (for the archive, newest first)
   * GSI2: Query by isActive status (for getting the current daily puzzle)
   */
  protected GSIKeys(item: SynergyConnectPuzzle): {
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

  protected dehydrateItem(item: SynergyConnectPuzzle): UnhydratedSynergyConnectPuzzle {
    return {
      id: item.id,
      type: item.type,
      date: item.date,
      theme: item.theme,
      groups: item.groups,
      order: item.order,
      isActive: item.isActive,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedSynergyConnectPuzzle): SynergyConnectPuzzle {
    return item;
  }

  protected async hydrateItems(items: UnhydratedSynergyConnectPuzzle[]): Promise<SynergyConnectPuzzle[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  public async getByDate(date: string): Promise<SynergyConnectPuzzle | undefined> {
    return this.get({
      PK: this.typedKey(date),
      SK: this.itemType(),
    });
  }

  public async getActive(): Promise<SynergyConnectPuzzle | undefined> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :active',
      ExpressionAttributeValues: {
        ':active': `${this.itemType()}#ACTIVE`,
      },
      ScanIndexForward: false,
      Limit: 1,
    };

    const result = await this.query(params);
    return result.items.length > 0 ? result.items[0] : undefined;
  }

  public async getHistory(
    lastKey?: Record<string, any>,
    limit: number = 20,
  ): Promise<{
    items: SynergyConnectPuzzle[];
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
        ScanIndexForward: false,
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
  public async setActivePuzzle(document: NewSynergyConnectPuzzle): Promise<SynergyConnectPuzzle> {
    const current = await this.getActive();
    if (current && current.date !== document.date) {
      await this.update({ ...current, isActive: false, dateLastUpdated: Date.now() });
    }

    const now = Date.now();
    const item: SynergyConnectPuzzle = {
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
