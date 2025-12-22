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
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
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
