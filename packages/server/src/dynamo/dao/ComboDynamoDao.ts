import { Sha256 } from '@aws-crypto/sha256-js';
import { BatchGetCommand, BatchWriteCommand, DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Combo } from '@utils/datatypes/CardCatalog';

import { DaoError } from '../../../errors/DaoError';
import { ErrorCode } from '../../../errors/errorCodes';
import { DynamoItem } from '../DynamoItem';
import { BaseDynamoDao, Key } from './BaseDynamoDao';

export class ComboDynamoDao extends BaseDynamoDao<Combo, Combo> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'COMBO';
  }

  /**
   * Creates a hash from a sorted list of oracle IDs.
   */
  private async hashOracleIds(oracleIds: string[]): Promise<string> {
    const sorted = [...oracleIds].sort();
    const hash = new Sha256();
    hash.update(sorted.join(','));
    const raw = await hash.digest();
    return Array.from(raw)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Gets the partition key for a combo.
   * Format: "COMBO#{hash}" where hash is the hash of sorted oracle IDs
   */
  protected partitionKey(item: Combo): string {
    // This will be set during put/batchPut operations
    // For get operations, use getByOracleIds instead
    throw new Error('Use getByOracleIds or getBatchByOracleIds instead of direct partitionKey access');
  }

  /**
   * Gets the sort key for a combo.
   */
  protected sortKey(_item: Combo): string {
    return this.itemType();
  }

  /**
   * No GSI keys needed for this simple key-value store.
   */
  protected GSIKeys(_item: Combo): {
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
   * Combos are stored as-is (no dehydration needed).
   */
  protected dehydrateItem(item: Combo): Combo {
    return item;
  }

  /**
   * Combos are stored as-is (no hydration needed).
   */
  protected hydrateItem(item: Combo): Combo {
    return item;
  }

  /**
   * Combos are stored as-is (no batch hydration needed).
   */
  protected async hydrateItems(items: Combo[]): Promise<Combo[]> {
    return items;
  }

  /**
   * Gets a combo by its oracle IDs.
   *
   * @param oracleIds - The oracle IDs that compose this combo.
   * @returns A promise that resolves to the combo, or undefined if not found.
   */
  async getByOracleIds(oracleIds: string[]): Promise<Combo | undefined> {
    const hash = await this.hashOracleIds(oracleIds);
    const key: Key = {
      PK: `${this.itemType()}#${hash}`,
      SK: this.itemType(),
    };

    const rawItem = await this.getRaw(key);
    return rawItem ? this.hydrateItem(rawItem.item) : undefined;
  }

  /**
   * Gets multiple combos by their oracle IDs in batch.
   * DynamoDB limits batch gets to 100 items per request.
   *
   * @param oracleIdSets - Array of oracle ID arrays, each representing a combo.
   * @returns A promise that resolves to an array of combos (undefined entries for not found).
   */
  async getBatchByOracleIds(oracleIdSets: string[][]): Promise<(Combo | undefined)[]> {
    if (oracleIdSets.length === 0) {
      return [];
    }

    // Generate hashes for all oracle ID sets
    const hashesToSets = new Map<string, string[]>();
    const hashes: string[] = [];
    
    for (const oracleIds of oracleIdSets) {
      const hash = await this.hashOracleIds(oracleIds);
      hashes.push(hash);
      hashesToSets.set(hash, oracleIds);
    }

    // Build keys for batch get
    const keys: Key[] = hashes.map((hash) => ({
      PK: `${this.itemType()}#${hash}`,
      SK: this.itemType(),
    }));

    // DynamoDB limits batch gets to 100 items
    const BATCH_SIZE = 100;
    const results = new Map<string, Combo>();

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batchKeys = keys.slice(i, i + BATCH_SIZE);

      try {
        const response = await this.dynamoClient.send(
          new BatchGetCommand({
            RequestItems: {
              [this.tableName]: {
                Keys: batchKeys,
              },
            },
          }),
        );

        if (response.Responses && response.Responses[this.tableName]) {
          const items = response.Responses[this.tableName] as DynamoItem<Combo>[];
          for (const dynamoItem of items) {
            const combo = this.hydrateItem(dynamoItem.item);
            // Extract hash from PK
            const hash = dynamoItem.PK.replace(`${this.itemType()}#`, '');
            results.set(hash, combo);
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new DaoError(`Error batch getting combos: ${error.message}`, ErrorCode.INTERNAL_SERVER_ERROR, {
          cause: error,
          meta: { batchIndex: i, batchSize: batchKeys.length },
        });
      }
    }

    // Map results back to original order
    return hashes.map((hash) => results.get(hash));
  }

  /**
   * Puts a combo by its oracle IDs.
   * This is an upsert operation.
   *
   * @param combo - The combo to store.
   * @param oracleIds - The oracle IDs that compose this combo.
   */
  async putByOracleIds(combo: Combo, oracleIds: string[]): Promise<void> {
    const hash = await this.hashOracleIds(oracleIds);
    const dynamoItem = this.toDynamoItem(combo);
    
    // Override PK with the hash-based key
    dynamoItem.PK = `${this.itemType()}#${hash}`;
    dynamoItem.SK = this.itemType();

    try {
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
        }),
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw new DaoError(`Error putting combo: ${error.message}`, ErrorCode.INTERNAL_SERVER_ERROR, {
        cause: error,
      });
    }
  }

  /**
   * Batch puts combos by their oracle IDs.
   * This is an upsert operation done in batches.
   *
   * @param combosWithOracleIds - Array of tuples containing [combo, oracleIds].
   * @param delayMs - Optional delay in milliseconds between batches.
   */
  async batchPutByOracleIds(
    combosWithOracleIds: [Combo, string[]][],
    delayMs: number = 0,
  ): Promise<void> {
    if (combosWithOracleIds.length === 0) {
      return;
    }

    // Build dynamo items with hash-based keys
    const dynamoItems: DynamoItem<Combo>[] = [];
    
    for (const [combo, oracleIds] of combosWithOracleIds) {
      const hash = await this.hashOracleIds(oracleIds);
      const dynamoItem = this.toDynamoItem(combo);
      
      // Override PK with the hash-based key
      dynamoItem.PK = `${this.itemType()}#${hash}`;
      dynamoItem.SK = this.itemType();
      
      dynamoItems.push(dynamoItem);
    }

    // Use the parent class's batch write logic
    const BATCH_SIZE = 25;
    for (let i = 0; i < dynamoItems.length; i += BATCH_SIZE) {
      const batch = dynamoItems.slice(i, i + BATCH_SIZE);

      const MAX_RETRIES = 3;
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await this.dynamoClient.send(
            new this.dynamoClient.config.serviceInputFactory.CommandCtor({
              RequestItems: {
                [this.tableName]: batch.map((dynamoItem) => ({
                  PutRequest: {
                    Item: dynamoItem,
                  },
                })),
              },
            }),
          );

          lastError = undefined;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));

          const isConnectionError =
            lastError.message.includes('ECONNABORTED') ||
            lastError.message.includes('ECONNRESET') ||
            lastError.message.includes('ETIMEDOUT') ||
            lastError.message.includes('socket hang up');

          if (isConnectionError && attempt < MAX_RETRIES - 1) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            console.warn(
              `Connection error on batch ${i}-${i + batch.length}, attempt ${attempt + 1}/${MAX_RETRIES}. Retrying in ${backoffMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          break;
        }
      }

      if (lastError) {
        throw new DaoError(`Error batch putting combos: ${lastError.message}`, ErrorCode.INTERNAL_SERVER_ERROR, {
          cause: lastError,
          meta: { batchIndex: i, batchSize: batch.length },
        });
      }

      if (delayMs > 0 && i + BATCH_SIZE < dynamoItems.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
