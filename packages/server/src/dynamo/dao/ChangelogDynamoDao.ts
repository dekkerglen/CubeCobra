import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { Changes } from '@utils/datatypes/Card';
import ChangeLog, { CubeChangeLog } from '@utils/datatypes/ChangeLog';
import { cardFromId } from 'serverutils/carddb';
import { v4 as uuidv4 } from 'uuid';

import ChangelogModel from '../models/changelog';
import { getBucketName, getObject, putObject } from '../s3client';
import { BaseDynamoDao } from './BaseDynamoDao';

const CARD_LIMIT = 10000;

/**
 * UnhydratedChangeLog represents the minimal data stored in DynamoDB.
 * The actual changelog data (Changes) is stored in S3.
 */
export interface UnhydratedChangeLog {
  id: string;
  cube: string;
  date: number;
}

/**
 * Changelog represents the hydrated version with the changelog data loaded from S3.
 */
export interface Changelog extends ChangeLog {
  changelog?: Changes;
}

/**
 * Sanitizes a changelog by removing card details before storing in S3.
 */
const sanitizeChangelog = (changelog: Changes): Changes => {
  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      for (let i = 0; i < value.adds.length; i++) {
        delete value.adds[i].details;
      }
    }
    if (value.removes) {
      for (let i = 0; i < value.removes.length; i++) {
        delete value.removes[i].oldCard.details;
      }
    }
    if (value.swaps) {
      for (let i = 0; i < value.swaps.length; i++) {
        delete value.swaps[i].oldCard.details;
        delete value.swaps[i].card.details;
      }
    }
    if (value.edits) {
      for (let i = 0; i < value.edits.length; i++) {
        delete value.edits[i].oldCard.details;
        delete value.edits[i].newCard.details;
      }
    }
  }
  return changelog;
};

/**
 * Hydrates a changelog by loading card details.
 */
const hydrateChangelog = (changelog: Changes): Changes => {
  let totalCards = 0;

  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      totalCards += value.adds.length;
    }
    if (value.removes) {
      totalCards += value.removes.length;
    }
    if (value.swaps) {
      totalCards += value.swaps.length;
    }
    if (value.edits) {
      totalCards += value.edits.length;
    }
  }

  if (totalCards > CARD_LIMIT) {
    throw new Error('Too many cards to load this changelog');
  }

  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      for (let i = 0; i < value.adds.length; i++) {
        value.adds[i].details = {
          ...cardFromId(value.adds[i].cardID),
        };
      }
    }
    if (value.removes) {
      for (let i = 0; i < value.removes.length; i++) {
        value.removes[i].oldCard.details = {
          ...cardFromId(value.removes[i].oldCard.cardID),
        };
      }
    }
    if (value.swaps) {
      for (let i = 0; i < value.swaps.length; i++) {
        value.swaps[i].oldCard.details = {
          ...cardFromId(value.swaps[i].oldCard.cardID),
        };
        value.swaps[i].card.details = {
          ...cardFromId(value.swaps[i].card.cardID),
        };
      }
    }
    if (value.edits) {
      for (let i = 0; i < value.edits.length; i++) {
        value.edits[i].oldCard.details = {
          ...cardFromId(value.edits[i].oldCard.cardID),
        };
        value.edits[i].newCard.details = {
          ...cardFromId(value.edits[i].newCard.cardID),
        };
      }
    }
  }
  return changelog;
};

/**
 * Gets the changelog data from S3.
 */
const getChangelogFromS3 = async (cubeId: string, id: string): Promise<Changes> => {
  const changelog = await getObject(getBucketName(), `changelog/${cubeId}/${id}.json`);

  try {
    return hydrateChangelog(changelog);
  } catch {
    return changelog;
  }
};

export class ChangelogDynamoDao extends BaseDynamoDao<Changelog, UnhydratedChangeLog> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'CHANGELOG';
  }

  /**
   * Gets the partition key for a changelog.
   */
  protected partitionKey(item: Changelog): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the changelog.
   * GSI1: Query by cube and date (descending)
   */
  protected GSIKeys(item: Changelog): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
  } {
    return {
      GSI1PK: item.cube ? `${this.itemType()}#CUBE#${item.cube}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
    };
  }

  /**
   * Dehydrates a Changelog to UnhydratedChangeLog for storage.
   * The changelog data is stored in S3, not in DynamoDB.
   */
  protected dehydrateItem(item: Changelog): UnhydratedChangeLog {
    return {
      id: item.id,
      cube: item.cube,
      date: item.date,
    };
  }

  /**
   * Hydrates a single UnhydratedChangeLog to Changelog.
   * Note: This does NOT load the changelog data from S3 by default.
   * Use getChangelogWithData or loadChangelogData for that.
   */
  protected hydrateItem(item: UnhydratedChangeLog): Changelog {
    return {
      id: item.id,
      cube: item.cube,
      date: item.date,
    };
  }

  /**
   * Hydrates multiple UnhydratedChangeLogs to Changelogs.
   * Note: This does NOT load the changelog data from S3.
   */
  protected async hydrateItems(items: UnhydratedChangeLog[]): Promise<Changelog[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Gets a changelog by ID without loading the changelog data from S3.
   */
  public async getById(id: string): Promise<Changelog | undefined> {
    if (this.dualWriteEnabled) {
      // For dual write, we still use the old model
      // Since the old model doesn't have a simple getById, we'd need to implement it differently
      // For now, just use the new path
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Gets a changelog by cube ID and changelog ID, loading the changelog data from S3.
   */
  public async getChangelog(cubeId: string, id: string): Promise<Changes> {
    if (this.dualWriteEnabled) {
      return ChangelogModel.getById(cubeId, id);
    }

    return getChangelogFromS3(cubeId, id);
  }

  /**
   * Gets a changelog by ID and loads the changelog data from S3.
   */
  public async getChangelogWithData(cubeId: string, id: string): Promise<CubeChangeLog> {
    const changelog = await getChangelogFromS3(cubeId, id);

    return {
      cubeId,
      date: 0, // We would need to fetch from DynamoDB to get the date
      changelog,
    };
  }

  /**
   * Loads the changelog data from S3 for an existing Changelog object.
   */
  public async loadChangelogData(changelog: Changelog): Promise<Changes> {
    return getChangelogFromS3(changelog.cube, changelog.id);
  }

  /**
   * Queries changelogs by cube, ordered by date descending, with pagination.
   * Returns metadata only - changelog data must be loaded separately.
   */
  public async queryByCube(
    cubeId: string | undefined,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: Changelog[];
    lastKey?: Record<string, any>;
  }> {
    // If cubeId is not provided but lastKey has it, extract it
    const effectiveCubeId = cubeId || lastKey?.cube;

    if (!effectiveCubeId) {
      throw new Error('cubeId must be provided either directly or in lastKey');
    }

    if (this.dualWriteEnabled) {
      const result = await ChangelogModel.getByCube(effectiveCubeId, limit, lastKey);
      return {
        items: (result.items || []).map((item) => ({
          id: '', // CubeChangeLog doesn't have id, we'd need to track it differently
          cube: item.cubeId,
          date: item.date,
          changelog: item.changelog,
        })),
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :cube',
      ExpressionAttributeValues: {
        ':cube': `${this.itemType()}#CUBE#${effectiveCubeId}`,
      },
      ScanIndexForward: false, // Descending order by date
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries changelogs by cube with changelog data loaded from S3.
   */
  public async queryByCubeWithData(
    cubeId: string | undefined,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CubeChangeLog[];
    lastKey?: Record<string, any>;
  }> {
    const result = await this.queryByCube(cubeId, lastKey, limit);

    const items: CubeChangeLog[] = await Promise.all(
      result.items.map(async (item) => ({
        cubeId: item.cube,
        date: item.date,
        changelog: await this.loadChangelogData(item),
      })),
    );

    return {
      items,
      lastKey: result.lastKey,
    };
  }

  /**
   * Creates a new changelog and stores it in both DynamoDB and S3.
   */
  public async createChangelog(changelog: Changes, cubeId: string): Promise<string> {
    const id = uuidv4();
    const date = new Date().valueOf();

    // Store the changelog data in S3
    await putObject(getBucketName(), `changelog/${cubeId}/${id}.json`, sanitizeChangelog(changelog));

    // Store the metadata in DynamoDB
    const changelogItem: Changelog = {
      id,
      cube: cubeId,
      date,
    };

    await this.put(changelogItem);
    return id;
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: Changelog): Promise<void> {
    if (this.dualWriteEnabled && item.changelog) {
      // Write to both old and new paths
      await Promise.all([ChangelogModel.put(item.changelog, item.cube), super.put(item)]);
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides delete to support dual writes.
   * Note: This only deletes the DynamoDB entry, not the S3 data.
   */
  public async delete(item: Changelog): Promise<void> {
    if (this.dualWriteEnabled) {
      // The old model doesn't have a delete method for individual changelogs
      await super.delete(item);
    } else {
      await super.delete(item);
    }
  }

  /**
   * Batch gets changelogs from S3 by their keys.
   * This is the main batch operation used by other DAOs like BlogDynamoDao.
   */
  public async batchGet(keys: Array<{ cube: string; id: string }>): Promise<Changes[]> {
    if (this.dualWriteEnabled) {
      return ChangelogModel.batchGet(keys.map((key) => ({ cube: key.cube, id: key.id })));
    }

    const result = await Promise.all(
      keys.map(async (key) => {
        const data = await getObject(getBucketName(), `changelog/${key.cube}/${key.id}.json`);
        try {
          return hydrateChangelog(data);
        } catch {
          return data;
        }
      }),
    );

    return result;
  }

  /**
   * Batch gets changelogs from S3 by their keys.
   * @deprecated Use batchGet instead
   */
  public async batchGetChangelogData(keys: Array<{ cube: string; id: string }>): Promise<Changes[]> {
    return this.batchGet(keys);
  }
}
