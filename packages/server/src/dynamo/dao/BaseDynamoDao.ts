import { Sha256 } from '@aws-crypto/sha256-js';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { BaseObject } from '@utils/datatypes/BaseObject';

import { DaoError } from '../../../errors/DaoError';
import { ErrorCode } from '../../../errors/errorCodes';
import { DynamoItem } from '../DynamoItem';

export interface Key {
  PK: string;
  SK: string;
}

export interface HashRow {
  PK: string;
  SK: string;
}

export abstract class BaseDynamoDao<T extends BaseObject, U extends BaseObject = T> {
  constructor(
    protected readonly dynamoClient: DynamoDBDocumentClient,
    protected readonly tableName: string,
  ) {}

  protected abstract itemType(): string;

  /**
   * Dehydrates a single item (T) to an unhydrated item (U) for storage.
   *
   * @param item - The hydrated item to transform.
   * @returns The unhydrated item.
   */
  protected abstract dehydrateItem(item: T): U;

  /**
   * Hydrates a single unhydrated item (U) to a hydrated item (T).
   *
   * @param item - The unhydrated item to transform.
   * @returns The hydrated item.
   */
  protected abstract hydrateItem(item: U): T | Promise<T>;

  /**
   * Hydrates multiple unhydrated items (U[]) to hydrated items (T[]).
   * This method should be overridden by subclasses to optimize batch hydration
   * (e.g., fetching all related entities in a single query).
   *
   * @param items - Array of unhydrated items to transform.
   * @returns Array of hydrated items.
   */
  protected abstract hydrateItems(items: U[]): Promise<T[]>;

  /**
   * Dehydrates multiple items (T[]) to unhydrated items (U[]) for storage.
   * Maps over each item and calls dehydrateItem.
   *
   * @param items - Array of hydrated items to transform.
   * @returns Array of unhydrated items.
   */
  protected dehydrateItems(items: T[]): U[] {
    return items.map((item) => this.dehydrateItem(item));
  }

  /**
   * Transforms a key into a key scoped to the item type.
   *
   * @param key - The key to transform.
   * @returns The transformed key.
   */
  protected typedKey(key: string | number): string {
    return `${this.itemType()}#${key}`;
  }

  /**
   * The partition key for the item.
   *
   * @param item - The item to get the partition key for.
   * @returns The partition key (the typed ID).
   */
  protected abstract partitionKey(item: T): string;

  /**
   * The sort key for the item. Should be overridden by subclasses if the item has a dynamic sort key.
   *
   * @param item - The item to get the sort key for.
   * @returns The sort key.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected sortKey(_item: T): string {
    return this.itemType();
  }

  /**
   * The GSI keys for the item. Should be overridden by subclasses if the item has GSI keys.
   *
   * @param item - The item to get the GSI keys for.
   * @returns The GSI keys, if any.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected GSIKeys(_item: T): {
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
      GSI1PK: undefined,
      GSI1SK: undefined,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Gets a raw DynamoItem by its PK and SK without hydration.
   *
   * @param key - The key to get.
   * @returns A promise that resolves to the raw DynamoItem, or undefined if the item does not exist.
   */
  private async getRaw(key: Key): Promise<DynamoItem<U> | undefined> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: key.PK,
            SK: key.SK,
          },
        }),
      );

      if (!response.Item) {
        return undefined;
      }

      return response.Item as DynamoItem<U>;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const code = error instanceof DaoError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;

      throw new DaoError(`Error getting item with key: ${error.message}`, code, { cause: error, meta: { key } });
    }
  }

  /**
   * Gets an item by its PK and SK.
   *
   * @param PK - The PK of the item.
   * @param SK - The SK of the item.
   * @returns A promise that resolves to the hydrated item, or undefined if the item does not exist.
   */
  protected async get(key: Key): Promise<T | undefined> {
    const dynamoItem = await this.getRaw(key);

    if (!dynamoItem) {
      return undefined;
    }

    return await this.hydrateItem(dynamoItem.item);
  }

  /**
   * Writes the item to the table, ensuring that the PK and SK do not already exist to prevent overwriting data.
   *
   * @param item - The item to write.
   */
  protected async putWithOptimisticLocking(item: T): Promise<void> {
    const dynamoItem = this.toDynamoItem(item);

    try {
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        }),
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const code = error instanceof DaoError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;

      throw new DaoError(`Error putting item: ${error}`, code, {
        cause: error,
      });
    }
  }

  /**
   * Updates the item in the table, ensuring that the DynamoVersion is as expected to prevent overwriting data.
   *
   * @param item - The item to write.
   * @param expectedDynamoVersion - The expected version of the item.
   */
  protected async updateWithOptimisticLocking(item: T, expectedDynamoVersion: number): Promise<void> {
    const dynamoItem = this.toDynamoItem(item);
    dynamoItem.DynamoVersion = expectedDynamoVersion + 1;

    try {
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK) AND DynamoVersion = :expectedVersion',
          ExpressionAttributeValues: {
            ':expectedVersion': expectedDynamoVersion,
          },
        }),
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const code = error instanceof DaoError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;

      throw new DaoError(`Error putting item: ${error}`, code, {
        cause: error,
      });
    }
  }

  /**
   * Enriches the item with the PK, SK, and GSI keys. Can be overridden by subclasses to add additional derived fields.
   *
   * @param item
   * @returns
   */
  protected toDynamoItem(object: T): DynamoItem<U> {
    const PK = this.partitionKey(object);
    const SK = this.sortKey(object);

    const GSIKeys = this.GSIKeys(object);

    const dehydrated = this.dehydrateItem(object);

    return {
      PK,
      SK,
      GSI1PK: GSIKeys.GSI1PK,
      GSI1SK: GSIKeys.GSI1SK,
      GSI2PK: GSIKeys.GSI2PK,
      GSI2SK: GSIKeys.GSI2SK,
      GSI3PK: GSIKeys.GSI3PK,
      GSI3SK: GSIKeys.GSI3SK,
      GSI4PK: GSIKeys.GSI4PK,
      GSI4SK: GSIKeys.GSI4SK,
      DynamoVersion: 1,
      item: dehydrated,
    };
  }

  /**
   * Queries the table using the provided parameters.
   *
   * @param params - The query parameters.
   * @returns A promise that resolves to the hydrated items and the key of the last item in the current page of results.
   */
  protected async query(params: QueryCommandInput): Promise<{
    items: T[];
    lastKey?: Record<string, any>;
  }> {
    try {
      const data = await this.dynamoClient.send(new QueryCommand(params));

      const dynamoItems = data.Items as DynamoItem<U>[];
      const unhydratedItems = dynamoItems.map((item) => item.item);
      const hydratedItems = await this.hydrateItems(unhydratedItems);

      return {
        items: hydratedItems,
        lastKey: data.LastEvaluatedKey,
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const code = error instanceof DaoError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;

      throw new DaoError(`Error querying items: ${error.message}`, code, {
        cause: error,
        meta: { params },
      });
    }
  }

  /**
   * Queries the table using the provided parameters and returns a single hydrated item.
   *
   * @param params - The query parameters.
   * @returns A promise that resolves to the hydrated item, or undefined if the item does not exist.
   */
  protected async queryOne(params: QueryCommandInput): Promise<T | undefined> {
    try {
      const data = await this.dynamoClient.send(new QueryCommand(params));

      if (data.Items && data.Items.length > 0) {
        const dynamoItem = data.Items[0] as DynamoItem<U>;
        return await this.hydrateItem(dynamoItem.item);
      }

      return undefined;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const code = error instanceof DaoError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;

      throw new DaoError(`Error querying one item: ${error.message}`, code, {
        cause: error,
        meta: { params },
      });
    }
  }

  /**
   * Writes a new item to the table.
   *
   * @param item - The item to write.
   */
  public async put(item: T): Promise<void> {
    return this.putWithOptimisticLocking(item);
  }

  /**
   * Writes multiple items to the table in batches of 25 (DynamoDB limit).
   * Note: BatchWrite does not support conditional writes, so this bypasses optimistic locking.
   * Use with caution, especially for updates.
   *
   * @param items - The items to write.
   * @param delayMs - Optional delay in milliseconds between batches to avoid overwhelming the connection pool.
   * @returns A promise that resolves when all items have been written.
   */
  public async batchPut(items: T[], delayMs: number = 0): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const dynamoItems = items.map((item) => this.toDynamoItem(item));

    // Batch writes in chunks of 25 (DynamoDB limit)
    const BATCH_SIZE = 25;
    for (let i = 0; i < dynamoItems.length; i += BATCH_SIZE) {
      const batch = dynamoItems.slice(i, i + BATCH_SIZE);

      // Retry logic for connection errors (ECONNABORTED, ECONNRESET, etc.)
      const MAX_RETRIES = 3;
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await this.dynamoClient.send(
            new BatchWriteCommand({
              RequestItems: {
                [this.tableName]: batch.map((dynamoItem) => ({
                  PutRequest: {
                    Item: dynamoItem,
                  },
                })),
              },
            }),
          );

          // Success - break retry loop
          lastError = undefined;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));

          // Check if it's a connection error that we should retry
          const isConnectionError =
            lastError.message.includes('ECONNABORTED') ||
            lastError.message.includes('ECONNRESET') ||
            lastError.message.includes('ETIMEDOUT') ||
            lastError.message.includes('socket hang up');

          if (isConnectionError && attempt < MAX_RETRIES - 1) {
            // Exponential backoff: 1s, 2s, 4s
            const backoffMs = Math.pow(2, attempt) * 1000;
            console.warn(
              `Connection error on batch ${i}-${i + batch.length}, attempt ${attempt + 1}/${MAX_RETRIES}. Retrying in ${backoffMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          // If not a connection error or out of retries, throw
          break;
        }
      }

      // If we still have an error after all retries, throw it
      if (lastError) {
        const code = lastError instanceof DaoError ? lastError.code : ErrorCode.INTERNAL_SERVER_ERROR;
        throw new DaoError(`Error batch putting items: ${lastError.message}`, code, {
          cause: lastError,
          meta: { batchIndex: i, batchSize: batch.length },
        });
      }

      // Add delay between batches if specified
      if (delayMs > 0 && i + BATCH_SIZE < dynamoItems.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  public async update(item: T): Promise<void> {
    const dynamoItem = await this.getRaw({
      PK: this.partitionKey(item),
      SK: this.sortKey(item),
    });

    if (!dynamoItem) {
      throw new DaoError('Item not found', ErrorCode.NOT_FOUND);
    }

    return this.updateWithOptimisticLocking(item, dynamoItem.DynamoVersion);
  }

  /**
   * Deletes an item from the table.
   *
   * @param item - The item to delete.
   */
  public async delete(item: T): Promise<void> {
    try {
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: this.partitionKey(item),
            SK: this.sortKey(item),
          },
        }),
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const code = error instanceof DaoError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;

      throw new DaoError(`Error deleting item: ${error}`, code, {
        cause: error,
      });
    }
  }

  /**
   * Creates a deterministic hash of the data using sorted key-value pairs.
   * Can be overridden by subclasses if they need custom hashing behavior.
   *
   * @param data - The data to hash.
   * @returns The hash of the data.
   */
  protected async hash(data: Record<string, string>): Promise<string> {
    data.ItemType = this.itemType();

    const list = Object.entries(data)
      .map(([key, value]) => `${key}:${value}`)
      .sort();

    const hash = new Sha256();
    hash.update(list.join(','));
    const raw = await hash.digest();
    return Array.from(raw)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Returns the hashes to store as hash rows for the item.
   * By default, returns an empty array (no hash rows).
   *
   * @param item - The item to get hashes for.
   * @returns A promise that resolves to an array of hashes.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async getHashes(_item: T): Promise<string[]> {
    return [];
  } /**
   * Writes hash rows for the item.
   *
   * @param itemPK - The partition key of the item.
   * @param hashes - The hashes to write.
   */
  protected async writeHashes(itemPK: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    const hashRows: HashRow[] = hashes.map((hash) => ({
      PK: hash,
      SK: itemPK,
    }));

    // Batch writes in chunks of 25 (DynamoDB limit)
    const BATCH_SIZE = 25;
    for (let i = 0; i < hashRows.length; i += BATCH_SIZE) {
      const batch = hashRows.slice(i, i + BATCH_SIZE);

      await this.dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((hashRow) => ({
              PutRequest: {
                Item: hashRow,
              },
            })),
          },
        }),
      );
    }
  }

  /**
   * Deletes hash rows for the item.
   *
   * @param itemPK - The partition key of the item.
   * @param hashes - The hashes to delete.
   */
  protected async deleteHashes(itemPK: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    const hashRows: HashRow[] = hashes.map((hash) => ({
      PK: hash,
      SK: itemPK,
    }));

    // Batch deletes in chunks of 25 (DynamoDB limit)
    const BATCH_SIZE = 25;
    for (let i = 0; i < hashRows.length; i += BATCH_SIZE) {
      const batch = hashRows.slice(i, i + BATCH_SIZE);

      await this.dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((hashRow) => ({
              DeleteRequest: {
                Key: hashRow,
              },
            })),
          },
        }),
      );
    }
  }

  /**
   * Queries items by hash, with pagination.
   * Returns hydrated items that match the hash.
   *
   * @param hash - The hash to query by.
   * @param lastKey - The key of the last item in the previous page of results.
   * @returns A promise that resolves to the hydrated items and the key of the last item in the current page of results.
   */
  protected async queryByHash(
    hash: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: T[];
    lastKey?: Record<string, any>;
  }> {
    const queryResult = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :PK',
        ExpressionAttributeValues: {
          ':PK': hash,
        },
        ExclusiveStartKey: lastKey,
      }),
    );

    if (!queryResult.Items) {
      return { items: [] };
    }

    const hashRows: HashRow[] = queryResult.Items as HashRow[];

    // Get unique item PKs from hash rows
    const itemPKs = Array.from(new Set(hashRows.map((hashRow) => hashRow.SK)));

    // Fetch all items by their PKs
    const items = await Promise.all(itemPKs.map((itemPK) => this.get({ PK: itemPK, SK: this.itemType() })));

    // Filter out undefined items
    const filteredItems = items.filter((item) => item !== undefined) as T[];

    return {
      items: filteredItems,
      lastKey: queryResult.LastEvaluatedKey,
    };
  }
}
