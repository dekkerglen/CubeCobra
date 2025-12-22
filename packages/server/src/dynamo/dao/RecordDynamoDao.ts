/**
 * RecordDynamoDao - Data Access Object for Record entities in a single-table DynamoDB design.
 *
 * STORAGE STRATEGY:
 * - Record metadata: Stored in DynamoDB with PK = RECORD#{id}, SK = RECORD
 * - Record analytics: Stored in S3 at record_analytic/{cubeId}.json
 *
 * QUERY PATTERNS:
 * - getById(id): Get record by ID
 * - queryByCube(cubeId, lastKey, limit): Get records by cube with pagination, sorted by date descending
 *
 * ANALYTICS METHODS:
 * - getAnalytics(cubeId): Get record analytics for a cube from S3
 * - putAnalytics(cubeId, analytic): Store record analytics for a cube to S3
 *
 * DUAL WRITE MODE:
 * Supports gradual migration from old record model by writing to both systems
 * when dualWriteEnabled flag is set.
 */

import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import RecordType from '@utils/datatypes/Record';
import { RecordAnalytic } from '@utils/datatypes/RecordAnalytic';
import { v4 as uuidv4 } from 'uuid';

import { getObject, putObject } from '../s3client';
import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * Extended Record type that includes fields required for DynamoDB storage.
 * This extends the base Record type with dateCreated and dateLastUpdated.
 */
export interface RecordEntity extends RecordType {
  dateCreated: number;
  dateLastUpdated: number;
}

/**
 * UnhydratedRecord is the record data as stored in DynamoDB.
 * Records don't have complex relationships, so hydrated and unhydrated are the same.
 */
export interface UnhydratedRecord {
  id: string;
  cube: string;
  date: number;
  name: string;
  description: string;
  players: RecordType['players'];
  matches: RecordType['matches'];
  trophy: string[];
  draft?: string;
  dateCreated: number;
  dateLastUpdated: number;
}

interface QueryResult {
  items: RecordEntity[];
  lastKey?: Record<string, NativeAttributeValue>;
}

export class RecordDynamoDao extends BaseDynamoDao<RecordEntity, UnhydratedRecord> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'RECORD';
  }

  /**
   * Gets the partition key for a record.
   */
  protected partitionKey(item: RecordType): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the record.
   * GSI1: Query by cube and date (sorted by date descending)
   */
  protected GSIKeys(item: RecordEntity): {
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
      GSI1PK: item.cube ? `${this.itemType()}#CUBE#${item.cube}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a RecordEntity to UnhydratedRecord for storage.
   * Records don't have complex relationships, so this is a straightforward mapping.
   */
  protected dehydrateItem(item: RecordEntity): UnhydratedRecord {
    return {
      id: item.id,
      cube: item.cube,
      date: item.date,
      name: item.name,
      description: item.description,
      players: item.players,
      matches: item.matches,
      trophy: item.trophy,
      draft: item.draft,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedRecord to RecordEntity.
   * Records don't have complex relationships, so this is a straightforward mapping.
   */
  protected async hydrateItem(item: UnhydratedRecord): Promise<RecordEntity> {
    return {
      id: item.id,
      cube: item.cube,
      date: item.date,
      name: item.name,
      description: item.description,
      players: item.players,
      matches: item.matches,
      trophy: item.trophy,
      draft: item.draft,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates multiple UnhydratedRecords to RecordEntities.
   * Records don't have complex relationships, so this is a straightforward mapping.
   */
  protected async hydrateItems(items: UnhydratedRecord[]): Promise<RecordEntity[]> {
    return items.map((item) => ({
      id: item.id,
      cube: item.cube,
      date: item.date,
      name: item.name,
      description: item.description,
      players: item.players,
      matches: item.matches,
      trophy: item.trophy,
      draft: item.draft,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    }));
  }

  /**
   * Fills in required details for a record, generating ID and date if not provided.
   */
  private fillRequiredDetails(document: Partial<RecordType>): RecordEntity {
    const now = Date.now();
    return {
      id: document.id || uuidv4(),
      cube: document.cube!,
      date: document.date || now,
      name: document.name!,
      description: document.description || '',
      players: document.players || [],
      matches: document.matches || [],
      trophy: document.trophy || [],
      draft: document.draft,
      dateCreated: now,
      dateLastUpdated: now,
    };
  }

  /**
   * Gets a record by ID.
   */
  public async getById(id: string): Promise<RecordEntity | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries records by cube, ordered by date descending, with pagination.
   */
  public async queryByCube(
    cube: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 36,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :cube',
      ExpressionAttributeValues: {
        ':cube': `${this.itemType()}#CUBE#${cube}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Alias for queryByCube with different parameter order for backward compatibility.
   * Matches the signature of the old model: getByCube(cube, limit, lastKey)
   */
  public async getByCube(
    cube: string,
    limit: number = 36,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<QueryResult> {
    return this.queryByCube(cube, lastKey, limit);
  }

  /**
   * Creates a new record with an auto-generated ID.
   * Returns the record ID.
   */
  public async createRecord(document: Partial<RecordType>): Promise<string> {
    const filled = this.fillRequiredDetails(document);

    await super.put(filled);

    return filled.id;
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: RecordEntity): Promise<void> {
    await super.put(item);
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: RecordEntity): Promise<void> {
    await super.update(item);
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: RecordEntity): Promise<void> {
    await super.delete(item);
  }

  /**
   * Deletes a record by ID (convenience method).
   */
  public async deleteById(id: string): Promise<void> {
    const record = await this.getById(id);
    if (record) {
      await this.delete(record);
    }
  }

  /**
   * ANALYTICS METHODS
   * Methods for managing record analytics data stored in S3.
   */

  /**
   * Gets analytics data for a cube from S3.
   * Analytics are keyed by oracle ID and contain win/loss statistics.
   *
   * @param cubeId - The cube ID to get analytics for
   * @returns Analytics data, or empty object if not found
   */
  public async getAnalytics(cubeId: string): Promise<RecordAnalytic> {
    try {
      return await getObject(process.env.DATA_BUCKET as string, `record_analytic/${cubeId}.json`);
    } catch {
      return {};
    }
  }

  /**
   * Stores analytics data for a cube to S3.
   *
   * @param cubeId - The cube ID to store analytics for
   * @param analytic - The analytics data to store
   */
  public async putAnalytics(cubeId: string, analytic: RecordAnalytic): Promise<void> {
    await putObject(process.env.DATA_BUCKET as string, `record_analytic/${cubeId}.json`, analytic);
  }
}

export default RecordDynamoDao;
