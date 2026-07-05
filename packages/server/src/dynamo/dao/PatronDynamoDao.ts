import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import Patron from '@utils/datatypes/Patron';

import { BaseDynamoDao } from './BaseDynamoDao';

export class PatronDynamoDao extends BaseDynamoDao<Patron, Patron> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'PATRON';
  }

  /**
   * Gets the partition key for a patron.
   */
  protected partitionKey(item: Patron): string {
    return this.typedKey(item.owner);
  }

  /**
   * Gets the GSI keys for the patron.
   * GSI1: Query by email
   * GSI2: Enumerate every patron under a single static partition (`PATRON#ALL`).
   *       Patron volume is low (~1k), so a hot partition is not a concern and no
   *       sharding is needed (unlike users/cubes). Sorted by owner for stable paging.
   */
  protected GSIKeys(item: Patron): {
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
      GSI1PK: item.email ? `${this.itemType()}#EMAIL#${item.email}` : undefined,
      GSI1SK: this.itemType(),
      GSI2PK: PatronDynamoDao.allPartitionKey(),
      GSI2SK: item.owner,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * The static GSI2 partition that holds every patron, used to enumerate them all.
   */
  public static allPartitionKey(): string {
    return 'PATRON#ALL';
  }

  /**
   * Dehydrates a Patron (no-op since Patron is already flat).
   */
  protected dehydrateItem(item: Patron): Patron {
    return {
      email: item.email,
      level: item.level,
      status: item.status,
      owner: item.owner,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single Patron (no-op since no external references).
   */
  protected async hydrateItem(item: Patron): Promise<Patron> {
    return item;
  }

  /**
   * Hydrates multiple Patrons (no-op since no external references).
   */
  protected async hydrateItems(items: Patron[]): Promise<Patron[]> {
    return items;
  }

  /**
   * Gets a patron by owner ID.
   */
  public async getById(id: string): Promise<Patron | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Gets a patron by email address.
   */
  public async getByEmail(email: string): Promise<Patron | undefined> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :email',
      ExpressionAttributeValues: {
        ':email': `${this.itemType()}#EMAIL#${email}`,
      },
      Limit: 1,
    };

    return this.queryOne(params);
  }

  /**
   * Enumerates a single page of all patrons via the GSI2 (`PATRON#ALL`) index.
   * Requires the GSI2 keys to have been backfilled onto existing rows.
   */
  public async getAllPatrons(
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<{ items: Patron[]; lastKey?: Record<string, any> }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :all',
      ExpressionAttributeValues: {
        ':all': PatronDynamoDao.allPartitionKey(),
      },
      Limit: limit,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    };

    return this.query(params);
  }

  /**
   * Enumerates every patron by paging through GSI2 internally. Intended for
   * bounded batch jobs (status reconciliation), not request-path use.
   */
  public async listAllPatrons(): Promise<Patron[]> {
    const all: Patron[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const page = await this.getAllPatrons(lastKey);
      all.push(...page.items);
      lastKey = page.lastKey;
    } while (lastKey);
    return all;
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: Patron): Promise<void> {
    await super.put(item);
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: Patron): Promise<void> {
    await super.update(item);
  }

  /**
   * Deletes a patron by owner ID.
   */
  public async deleteById(id: string): Promise<void> {
    await super.delete({
      email: '',
      level: 0,
      status: '',
      owner: id,
      dateCreated: 0,
      dateLastUpdated: 0,
    });
  }

  /**
   * Batch puts multiple patrons.
   */
  public async batchPut(items: Patron[]): Promise<void> {
    await super.batchPut(items);
  }
}
