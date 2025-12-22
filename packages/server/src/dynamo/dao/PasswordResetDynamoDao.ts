import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import PasswordReset, { UnhydratedPasswordReset } from '@utils/datatypes/PasswordReset';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';

export class PasswordResetDynamoDao extends BaseDynamoDao<PasswordReset, PasswordReset> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'PASSWORD_RESET';
  }

  /**
   * Gets the partition key for a password reset.
   */
  protected partitionKey(item: PasswordReset): string {
    return this.typedKey(item.id);
  }

  /**
   * Dehydrates a PasswordReset (no-op since PasswordReset is already flat).
   */
  protected dehydrateItem(item: PasswordReset): PasswordReset {
    return {
      id: item.id,
      owner: item.owner,
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single PasswordReset (no-op since no external references).
   */
  protected async hydrateItem(item: PasswordReset): Promise<PasswordReset> {
    return item;
  }

  /**
   * Hydrates multiple PasswordResets (no-op since no external references).
   */
  protected async hydrateItems(items: PasswordReset[]): Promise<PasswordReset[]> {
    return items;
  }

  /**
   * Gets a password reset by ID.
   */
  public async getById(id: string): Promise<PasswordReset | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Overrides put to support dual writes and return the ID.
   * Accepts both UnhydratedPasswordReset and PasswordReset types, with optional dateCreated/dateLastUpdated.
   */
  public async putAndReturnId(
    document: Omit<UnhydratedPasswordReset, 'dateCreated' | 'dateLastUpdated'> & {
      dateCreated?: number;
      dateLastUpdated?: number;
    },
  ): Promise<string> {
    // Generate ID if not provided
    const id = document.id || uuidv4();

    const now = Date.now();

    // Create the password reset object
    const passwordReset: PasswordReset = {
      id,
      owner: document.owner,
      date: document.date,
      dateCreated: document.dateCreated ?? now,
      dateLastUpdated: document.dateLastUpdated ?? now,
    };

    await super.put(passwordReset);

    return id;
  }

  /**
   * Overrides put to support dual writes.
   * Accepts both UnhydratedPasswordReset and PasswordReset types, with optional dateCreated/dateLastUpdated.
   */
  public async put(
    item: Omit<UnhydratedPasswordReset, 'dateCreated' | 'dateLastUpdated'> & {
      dateCreated?: number;
      dateLastUpdated?: number;
    },
  ): Promise<void> {
    await this.putAndReturnId(item);
  }

  /**
   * Batch puts multiple password resets.
   */
  public async batchPut(items: PasswordReset[]): Promise<void> {
    await super.batchPut(items);
  }
}
