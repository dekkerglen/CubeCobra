/**
 * UserDynamoDao - Data Access Object for User entities in a single-table DynamoDB design.
 *
 * STORAGE STRATEGY:
 * - User data: Stored in DynamoDB with PK = USER#{id}, SK = USER
 * - Sensitive data (password hash, email) is preserved but stripped for most operations
 *
 * QUERY PATTERNS:
 * - getById(id): Get user by ID
 * - getByIdWithSensitiveData(id): Get user with password hash and email
 * - getByUsername(username): Get user by username (case-insensitive)
 * - getByEmail(email): Get user by email (case-insensitive)
 * - getByIdOrUsername(idOrUsername): Get user by ID first, fallback to username
 * - batchGet(ids): Get multiple users by IDs
 *
 * GSI STRUCTURE:
 * - GSI1: Query by username (usernameLower)
 * - GSI2: Query by email (case-insensitive)
 */

import { BatchGetCommand, DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { BaseObject } from '@utils/datatypes/BaseObject';
import { DefaultPrintingPreference } from '@utils/datatypes/Card';
import User, {
  DefaultGridTightnessPreference,
  UnhydratedUser,
  UserWithSensitiveInformation,
} from '@utils/datatypes/User';
import { getImageData } from 'serverutils/imageutil';

import { DaoError } from '../../../errors/DaoError';
import { ErrorCode } from '../../../errors/errorCodes';
import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * Extended User type with BaseObject fields for DAO operations
 */
export type UserWithBaseFields = User & BaseObject;

/**
 * Extended UserWithSensitiveInformation type with BaseObject fields for storage
 */
export type StoredUserWithSensitiveInfo = UserWithSensitiveInformation & BaseObject;

export class UserDynamoDao extends BaseDynamoDao<UserWithBaseFields, StoredUserWithSensitiveInfo> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'USER';
  }

  /**
   * Gets the partition key for a user.
   */
  protected partitionKey(item: UserWithBaseFields): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the user.
   * GSI1: Query by username (case-insensitive)
   * GSI2: Query by email (case-insensitive)
   */
  protected GSIKeys(item: UserWithBaseFields): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    const usernameLower = item.username?.toLowerCase();
    // For UserWithSensitiveInformation, email is always present; for User, it may be stripped
    const email = (item as any).email?.toLowerCase();

    return {
      GSI1PK: usernameLower ? `${this.itemType()}#USERNAME#${usernameLower}` : undefined,
      GSI1SK: this.itemType(),
      GSI2PK: email ? `${this.itemType()}#EMAIL#${email}` : undefined,
      GSI2SK: this.itemType(),
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a User to StoredUserWithSensitiveInfo for storage.
   * This is used when we have sensitive data to store.
   */
  protected dehydrateItem(item: UserWithBaseFields): StoredUserWithSensitiveInfo {
    const dehydrated: any = {
      id: item.id,
      username: item.username,
      usernameLower: item.username?.toLowerCase(),
      cubes: item.cubes?.map((cube) => (typeof cube === 'string' ? cube : cube.id)),
      about: item.about,
      hideTagColors: item.hideTagColors,
      followedCubes: item.followedCubes,
      followedUsers: item.followedUsers,
      following: item.following,
      imageName: item.imageName,
      roles: item.roles,
      theme: item.theme,
      hideFeatured: item.hideFeatured,
      patron: item.patron,
      defaultPrinting: item.defaultPrinting,
      gridTightness: item.gridTightness,
      autoBlog: item.autoBlog,
      consentToHashedEmail: item.consentToHashedEmail,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      token: item?.token,
    };

    // Preserve sensitive data if it exists
    if ((item as any).passwordHash) {
      dehydrated.passwordHash = (item as any).passwordHash;
    }
    if ((item as any).email) {
      dehydrated.email = (item as any).email;
    }

    return dehydrated;
  }

  /**
   * Strips sensitive data from a user object.
   */
  private stripSensitiveData(user: StoredUserWithSensitiveInfo): UnhydratedUser & BaseObject {
    const sanitized = { ...user };
    //@ts-expect-error -- Typescript says property must be optional to delete, but we are switching types so not relevant
    delete sanitized.passwordHash;
    //@ts-expect-error --  Ditto
    delete sanitized.email;

    return sanitized;
  }

  /**
   * Hydrates a single StoredUserWithSensitiveInfo to UserWithBaseFields.
   */
  protected async hydrateItem(item: StoredUserWithSensitiveInfo): Promise<UserWithBaseFields> {
    // Strip sensitive data before hydration
    const unhydrated = this.stripSensitiveData(item);

    const hydrated = { ...unhydrated } as UserWithBaseFields;
    hydrated.image = getImageData(hydrated.imageName || 'Ambush Viper');

    if (!hydrated.defaultPrinting) {
      hydrated.defaultPrinting = DefaultPrintingPreference;
    }
    if (typeof hydrated.autoBlog === 'undefined') {
      hydrated.autoBlog = false;
    }

    if (!hydrated.gridTightness) {
      hydrated.gridTightness = DefaultGridTightnessPreference;
    }

    return hydrated;
  }

  /**
   * Hydrates multiple StoredUserWithSensitiveInfo to UserWithBaseFields.
   */
  protected async hydrateItems(items: StoredUserWithSensitiveInfo[]): Promise<UserWithBaseFields[]> {
    return Promise.all(items.map((item) => this.hydrateItem(item)));
  }

  /**
   * Gets a user by ID, stripping sensitive data.
   */
  public async getById(id: string): Promise<User | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Gets a user by ID with sensitive information (password hash, email).
   */
  public async getByIdWithSensitiveData(id: string): Promise<StoredUserWithSensitiveInfo | undefined> {
    const dynamoItem = await this.getRaw({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });

    if (!dynamoItem) {
      return undefined;
    }

    return dynamoItem.item;
  }

  /**
   * Queries a user by username (case-insensitive).
   */
  public async getByUsername(username: string): Promise<User | null> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :username',
      ExpressionAttributeValues: {
        ':username': `${this.itemType()}#USERNAME#${username.toLowerCase()}`,
      },
      Limit: 1,
    };

    const result = await this.query(params);

    if (result.items.length > 0) {
      return result.items[0] ?? null;
    }

    return null;
  }

  /**
   * Queries a user by email (case-insensitive).
   */
  public async getByEmail(email: string): Promise<User | null> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :email',
      ExpressionAttributeValues: {
        ':email': `${this.itemType()}#EMAIL#${email.toLowerCase()}`,
      },
      Limit: 1,
    };

    const result = await this.query(params);

    if (result.items.length > 0) {
      return result.items[0] ?? null;
    }

    return null;
  }

  /**
   * Gets a user by ID or username.
   * First attempts to get by ID (fast direct lookup), then falls back to username query.
   */
  public async getByIdOrUsername(idOrUsername: string): Promise<User | null> {
    // Try to get by ID first
    const userById = await this.getById(idOrUsername);

    if (userById) {
      return userById;
    }

    // Fallback to username lookup
    return this.getByUsername(idOrUsername);
  }

  /**
   * Batch gets multiple users by their IDs.
   */
  public async batchGet(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    // Deduplicate IDs to avoid DynamoDB validation error
    const uniqueIds = Array.from(new Set(ids));

    // Use the base class method to fetch items
    const keys = uniqueIds.map((id) => ({
      PK: this.typedKey(id),
      SK: this.itemType(),
    }));

    // We need to implement batch get using the dynamoClient directly
    // since BaseDynamoDao doesn't expose a batchGet method by default
    const BATCH_SIZE = 100; // DynamoDB limit
    const allItems: StoredUserWithSensitiveInfo[] = [];

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      const response = await this.dynamoClient.send(
        new BatchGetCommand({
          RequestItems: {
            [this.tableName]: {
              Keys: batch,
            },
          },
        }),
      );

      const items = response.Responses?.[this.tableName] || [];
      allItems.push(...items.map((item: any) => item.item));
    }

    return this.hydrateItems(allItems);
  }

  /**
   * Batch gets multiple users by their IDs with sensitive information (password hash, email).
   * Returns users with all fields including sensitive data.
   */
  public async batchGetWithSensitiveData(ids: string[]): Promise<StoredUserWithSensitiveInfo[]> {
    if (ids.length === 0) {
      return [];
    }

    // Deduplicate IDs to avoid DynamoDB validation error
    const uniqueIds = Array.from(new Set(ids));

    // Use the base class method to fetch items
    const keys = uniqueIds.map((id) => ({
      PK: this.typedKey(id),
      SK: this.itemType(),
    }));

    // Implement batch get using the dynamoClient directly
    const BATCH_SIZE = 100; // DynamoDB limit
    const allItems: StoredUserWithSensitiveInfo[] = [];

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      const response = await this.dynamoClient.send(
        new BatchGetCommand({
          RequestItems: {
            [this.tableName]: {
              Keys: batch,
            },
          },
        }),
      );

      const items = response.Responses?.[this.tableName] || [];
      // Return the raw items with sensitive data, no hydration needed
      allItems.push(...items.map((item: any) => item.item));
    }

    return allItems;
  }

  /**
   * Creates a new user, generating an ID if not provided.
   * Uses optimistic locking to prevent duplicate creation.
   *
   * @param user - The user to create (can omit id, it will be generated)
   * @returns The ID of the created user
   */
  public async createUser(
    user:
      | (Omit<User, 'id'> & Partial<Pick<User, 'id'>>)
      | (Omit<UserWithSensitiveInformation, 'id'> & Partial<Pick<UserWithSensitiveInformation, 'id'>>),
  ): Promise<string> {
    const userId = user.id || (await import('uuid')).v4();
    const now = Date.now();

    const userWithId: any = {
      ...user,
      id: userId,
      usernameLower: user.username?.toLowerCase(),
      dateCreated: (user as any).dateCreated ?? now,
      dateLastUpdated: (user as any).dateLastUpdated ?? now,
    };

    await super.put(userWithId);

    return userId;
  }

  /**
   * Puts a user.
   */
  public async put(item: User | UserWithSensitiveInformation | UserWithBaseFields): Promise<void> {
    // Ensure usernameLower and BaseObject fields are set
    const now = Date.now();
    const itemWithLower: any = {
      ...item,
      usernameLower: item.username?.toLowerCase(),
      dateCreated: (item as any).dateCreated ?? now,
      dateLastUpdated: (item as any).dateLastUpdated ?? now,
    };

    await super.put(itemWithLower);
  }

  /**
   * Updates a user and merges with existing data.
   */
  public async update(document: User | UserWithBaseFields | UserWithSensitiveInformation): Promise<void> {
    // Fetch existing document to preserve sensitive fields
    const existing = await this.getByIdWithSensitiveData(document.id);

    if (!existing) {
      throw new DaoError('User not found for update', ErrorCode.NOT_FOUND);
    }

    // Merge incoming document with existing, only updating fields that are explicitly set (not undefined)
    // This prevents erasing sensitive fields when updating a user object that was loaded without sensitive data
    const merged: any = { ...existing };

    for (const [key, value] of Object.entries(document)) {
      if (key !== 'id' && value !== undefined) {
        merged[key] = value;
      }
    }

    // Ensure dateLastUpdated is updated
    merged.dateCreated = merged.dateCreated ?? Date.now();
    merged.dateLastUpdated = Date.now();

    await super.update(merged as UserWithBaseFields);
  }

  /**
   * Batch puts multiple users.
   * Preserves sensitive data (passwordHash, email) by merging with existing records.
   */
  public async batchPut(documents: User[]): Promise<void> {
    const now = Date.now();

    // Fetch existing users to preserve sensitive data
    const existingUsers = await Promise.all(documents.map((doc) => this.getByIdWithSensitiveData(doc.id)));

    // Merge incoming documents with existing data, preserving sensitive fields
    const normalizedDocs = documents.map((doc, index) => {
      const existing = existingUsers[index];

      if (!existing) {
        // New user - just normalize
        return {
          ...doc,
          usernameLower: doc.username?.toLowerCase(),
          dateCreated: (doc as any).dateCreated ?? now,
          dateLastUpdated: (doc as any).dateLastUpdated ?? now,
        };
      }

      // Existing user - merge to preserve sensitive data
      const merged: any = { ...existing };

      for (const [key, value] of Object.entries(doc)) {
        if (key !== 'id' && value !== undefined) {
          merged[key] = value;
        }
      }

      merged.usernameLower = doc.username?.toLowerCase();
      merged.dateCreated = merged.dateCreated ?? now;
      merged.dateLastUpdated = now;

      return merged;
    }) as UserWithBaseFields[];

    await super.batchPut(normalizedDocs);
  }

  /**
   * Batch adds multiple users (alias for batchPut for backwards compatibility).
   */
  public async batchAdd(documents: User[]): Promise<void> {
    return this.batchPut(documents);
  }

  /**
   * Deletes a user by ID.
   */
  public async deleteById(id: string): Promise<void> {
    const user = await this.getById(id);
    if (!user) {
      return;
    }

    const userWithBase = user as UserWithBaseFields;

    await this.delete(userWithBase);
  }
}
