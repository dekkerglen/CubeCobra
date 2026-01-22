/**
 * CubeDynamoDao - Data Access Object for Cube entities in a single-table DynamoDB design.
 *
 * STORAGE STRATEGY:
 * - Cube metadata: Stored in DynamoDB with PK = CUBE#{id}, SK = CUBE
 * - Cube cards: Stored in S3 at cube/{id}.json
 * - Cube analytics: Stored in S3 at cube_analytic/{id}.json
 * - Hash rows: Stored with PK = HASH#CUBE#{id}, SK = hashString for search functionality
 *
 * QUERY PATTERNS:
 * - getById(id): Get cube by ID or shortId
 * - queryByOwner(ownerId, sortBy): Get cubes by owner with sorting
 * - queryAllCubes(sortBy): Get all public cubes with sorting
 * - queryByFeatured(sortBy): Get featured cubes with sorting
 * - queryByCategory(category, sortBy): Get cubes by category with sorting
 * - queryByTag(tag, sortBy): Get cubes by tag with sorting
 * - queryByKeyword(keywords, sortBy): Get cubes by name keywords with sorting
 * - queryByOracleId(oracleId, sortBy): Get cubes containing a specific card
 * - queryByMultipleHashes(hashes, sortBy, lastKey, cardCountFilter): Get cubes matching ALL hash criteria
 *   using efficient two-phase querying (first hash + filtering). Uses GSI for sorting (not in-memory).
 *   Card count filters are applied in memory. Supports pagination.
 *   Tip: Put most restrictive criteria first for best performance.
 * - getHashesForCube(cubeId): Get all hash rows for a cube (for cleanup/sweeper operations)
 * - repairHashes(cubeId): Repair hash rows by comparing current vs expected and writing the delta
 *
 * ANALYTICS METHODS:
 * - getAnalytics(cubeId): Get cube analytics from S3
 * - putAnalytics(cubeId, analytic): Update analytics for a single cube
 * - batchPutAnalytics(analytics): Batch update analytics for multiple cubes
 * - deleteAnalytics(cubeId): Delete analytics for a cube
 * - analyticsExist(cubeId): Check if analytics exist for a cube
 *
 * SORTING OPTIONS (for hash-based queries):
 * - 'popularity': Sort by follower count (default)
 * - 'alphabetical': Sort by cube name
 * - 'cards': Sort by card count
 * - 'date': Sort by last updated date
 *
 * HASH ROW STRUCTURE:
 * Hash rows enable efficient search with sortable attributes:
 * - PK: HASH#CUBE#{cubeId} (allows querying all hashes for a cube)
 * - SK: hash string (e.g., "shortid:mycube", "tag:vintage", "oracle:abc123")
 * - GSI1PK: hash string, GSI1SK: FOLLOWERS#... for popularity sorting
 * - GSI2PK: hash string, GSI2SK: NAME#... for alphabetical sorting
 * - GSI3PK: hash string, GSI3SK: CARDS#... for card count sorting
 * - GSI4PK: hash string, GSI4SK: DATE#... for recency sorting
 *
 * CUBE METADATA ROW STRUCTURE:
 * Main cube metadata rows (PK=CUBE#{id}, SK=CUBE) use:
 * - GSI1: Owner + date for querying user's cubes
 * - GSI3: Shard + id for scanning all cubes efficiently
 * Note: GSI2 is NOT used for cube metadata, only for hash rows
 *
 * DUAL WRITE MODE:
 * Supports gradual migration from old cube model by writing to both systems
 * when dualWriteEnabled flag is set.
 */

import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { CardStatus } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import { CubeCards } from '@utils/datatypes/Cube';
import CubeAnalytic from '@utils/datatypes/CubeAnalytic';
import User from '@utils/datatypes/User';
import { normalizeDraftFormatSteps } from '@utils/draftutil';
import { cardFromId, getPlaceholderCard } from 'serverutils/carddb';
import cloudwatch from 'serverutils/cloudwatch';
import { getImageData } from 'serverutils/imageutil';

import { deleteObject, getObject, putObject } from '../s3client';
import { getObjectVersion, listObjectVersions } from '../s3client';
import { BaseDynamoDao, HashRow } from './BaseDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

/**
 * UnhydratedCube is the cube metadata without the owner User object and image.
 * This is what we store in DynamoDB.
 */
export interface UnhydratedCube {
  id: string;
  shortId: string;
  owner: string; // User ID instead of User object
  name: string;
  visibility: string;
  priceVisibility: string;
  featured: boolean;
  categoryOverride?: string;
  categoryPrefixes: any[];
  tagColors: any[];
  defaultFormat: number;
  numDecks: number;
  description: string;
  imageName: string;
  date: number; // Legacy field - this is dateLastUpdated, kept for backwards compatibility
  dateCreated: number;
  dateLastUpdated: number;
  defaultSorts: string[];
  showUnsorted?: boolean;
  collapseDuplicateCards?: boolean;
  formats: any[];
  following: string[];
  defaultStatus: CardStatus;
  defaultPrinting: string;
  disableAlerts: boolean;
  basics: string[];
  tags: any[];
  keywords: string[];
  cardCount: number;
  version: number;
}

interface QueryResult {
  items: Cube[];
  lastKey?: Record<string, any>;
}

export type SortOrder = 'popularity' | 'alphabetical' | 'cards' | 'date';

const CARD_LIMIT = 10000;

/**
 * Creates a placeholder user for deleted/banned accounts
 */
const createDeletedUserPlaceholder = (userId: string): User => {
  return {
    id: userId,
    username: '[Deleted User]',
    email: '',
    about: '',
    hideTagColors: false,
    defaultNav: [],
    roles: [],
    theme: 'default',
    hideFeatured: false,
    followedCubes: [],
    followedUsers: [],
    notifications: [],
    imageName: 'default',
    patron: '',
  } as User;
};

export class CubeDynamoDao extends BaseDynamoDao<Cube, UnhydratedCube> {
  private readonly userDao: UserDynamoDao;

  constructor(dynamoClient: DynamoDBDocumentClient, userDao: UserDynamoDao, tableName: string) {
    super(dynamoClient, tableName);
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'CUBE';
  }

  /**
   * Gets the partition key for a cube.
   */
  protected partitionKey(item: Cube): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the cube.
   * GSI1: Query by owner and date
   * GSI3: Sharding for scanning all cubes
   * Note: GSI2 is not used for cube metadata (only for hash rows)
   */
  protected GSIKeys(item: Cube): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    // Handle both User object and string owner ID
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;
    // last digit of ID for sharding
    const shard = item.id.charCodeAt(item.id.length - 1) % 10; // Simple sharding by last character of ID

    return {
      GSI1PK: ownerId ? `${this.itemType()}#OWNER#${ownerId}` : undefined,
      GSI1SK: item.dateLastUpdated ? `DATE#${item.dateLastUpdated}` : undefined,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: `${this.itemType()}#${shard}`,
      GSI3SK: item.id,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a Cube to UnhydratedCube for storage.
   */
  protected dehydrateItem(item: Cube): UnhydratedCube {
    return {
      id: item.id,
      shortId: item.shortId,
      owner: typeof item.owner === 'string' ? item.owner : item.owner?.id,
      name: item.name,
      visibility: item.visibility,
      priceVisibility: item.priceVisibility,
      featured: item.featured,
      categoryOverride: item.categoryOverride,
      categoryPrefixes: item.categoryPrefixes,
      tagColors: item.tagColors,
      defaultFormat: item.defaultFormat,
      numDecks: item.numDecks,
      description: item.description,
      imageName: item.imageName,
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      defaultSorts: item.defaultSorts,
      showUnsorted: item.showUnsorted,
      collapseDuplicateCards: item.collapseDuplicateCards,
      formats: item.formats,
      following: item.following,
      defaultStatus: item.defaultStatus,
      defaultPrinting: item.defaultPrinting,
      disableAlerts: item.disableAlerts,
      basics: item.basics,
      tags: item.tags,
      keywords: item.keywords,
      cardCount: item.cardCount,
      version: item.version,
    };
  }

  /**
   * Hydrates a single UnhydratedCube to Cube.
   */
  protected async hydrateItem(item: UnhydratedCube): Promise<Cube> {
    // Handle cubes with invalid owner
    if (!item.owner) {
      cloudwatch.error(`Cube ${item.id} has null or undefined owner - using deleted user placeholder`);
      const deletedUser = createDeletedUserPlaceholder('deleted');
      const image = getImageData(item.imageName);

      const draftFormats = item.formats || [];
      for (let format of draftFormats) {
        format = normalizeDraftFormatSteps(format);
      }

      return {
        ...item,
        owner: deletedUser,
        image,
      } as Cube;
    }

    const owner = await this.userDao.getById(item.owner);

    // If owner doesn't exist in the database, use placeholder
    if (!owner) {
      cloudwatch.error(
        `Cube ${item.id} has owner ${item.owner} that doesn't exist in database - using deleted user placeholder`,
      );
      const deletedUser = createDeletedUserPlaceholder(item.owner);
      const image = getImageData(item.imageName);

      const draftFormats = item.formats || [];
      for (let format of draftFormats) {
        format = normalizeDraftFormatSteps(format);
      }

      return {
        ...item,
        owner: deletedUser,
        image,
      } as Cube;
    }

    const image = getImageData(item.imageName);

    const draftFormats = item.formats || [];
    // Correct bad custom draft formats on load
    for (let format of draftFormats) {
      format = normalizeDraftFormatSteps(format);
    }

    return {
      ...item,
      owner: owner,
      image,
    } as Cube;
  }

  /**
   * Hydrates multiple UnhydratedCubes to Cubes (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedCube[]): Promise<Cube[]> {
    if (items.length === 0) {
      return [];
    }

    // Separate items with and without owners
    const itemsWithOwners: UnhydratedCube[] = [];
    const itemsWithoutOwners: UnhydratedCube[] = [];

    for (const item of items) {
      if (!item.owner) {
        cloudwatch.error(`Cube ${item.id} has null or undefined owner - using deleted user placeholder`);
        itemsWithoutOwners.push(item);
      } else {
        itemsWithOwners.push(item);
      }
    }

    // Get owners for valid items
    const ownerIds = itemsWithOwners.map((item) => item.owner);
    const owners = ownerIds.length > 0 ? await this.userDao.batchGet(ownerIds) : [];

    // Hydrate items with owners
    const cubesWithOwners = itemsWithOwners.map((item) => {
      const owner = owners.find((o: User) => o.id === item.owner);

      // If owner doesn't exist, use placeholder
      const finalOwner =
        owner ||
        (() => {
          cloudwatch.error(
            `Cube ${item.id} has owner ${item.owner} that doesn't exist in database - using deleted user placeholder`,
          );
          return createDeletedUserPlaceholder(item.owner);
        })();

      const image = getImageData(item.imageName);

      const draftFormats = item.formats || [];
      for (let format of draftFormats) {
        format = normalizeDraftFormatSteps(format);
      }

      return {
        ...item,
        owner: finalOwner,
        image,
      } as Cube;
    });

    // Hydrate items without owners
    const cubesWithoutOwners = itemsWithoutOwners.map((item) => {
      const deletedUser = createDeletedUserPlaceholder('deleted');
      const image = getImageData(item.imageName);

      const draftFormats = item.formats || [];
      for (let format of draftFormats) {
        format = normalizeDraftFormatSteps(format);
      }

      return {
        ...item,
        owner: deletedUser,
        image,
      } as Cube;
    });

    return [...cubesWithOwners, ...cubesWithoutOwners];
  }

  /**
   * Gets a cube by ID (supports both full ID and shortId).
   */
  public async getById(id: string): Promise<Cube | null | undefined> {
    // Try by full ID first
    const byId = await this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });

    if (byId) {
      return byId;
    }

    // Try by shortId using hash lookup from the new unified table
    const shortIdHash = await this.hash({ type: 'shortid', value: id });
    const hashResult = await this.queryByHashForIdsOnly(shortIdHash, 'popularity', false, undefined, 2);

    if (hashResult.cubeIds.length > 0) {
      const cubeId = hashResult.cubeIds[0]!;
      return this.get({
        PK: this.typedKey(cubeId),
        SK: this.itemType(),
      });
    }

    return null;
  }

  /**
   * Batch gets cubes by IDs.
   */
  public async batchGet(ids: string[]): Promise<Cube[]> {
    if (ids.length === 0) {
      return [];
    }

    // Get all cubes in parallel
    const cubes = await Promise.all(
      ids.map((id) =>
        this.get({
          PK: this.typedKey(id),
          SK: this.itemType(),
        }),
      ),
    );

    return cubes.filter((cube) => cube !== undefined) as Cube[];
  }

  /**
   * Queries cubes by owner with sorting and pagination.
   */
  public async queryByOwner(
    owner: string,
    sortBy: SortOrder = 'date',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<QueryResult> {
    // For owner queries, we can only sort by date using GSI1
    // For other sorts, we need to fetch all and sort in memory
    if (sortBy === 'date') {
      const params: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :owner',
        ExpressionAttributeValues: {
          ':owner': `${this.itemType()}#OWNER#${owner}`,
        },
        ScanIndexForward: ascending,
        Limit: limit,
        ExclusiveStartKey: lastKey,
      };

      return this.query(params);
    } else {
      // Fetch all cubes for this owner and sort in memory
      const allCubes: Cube[] = [];
      let currentLastKey: Record<string, any> | undefined = undefined;

      do {
        const params: QueryCommandInput = {
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :owner',
          ExpressionAttributeValues: {
            ':owner': `${this.itemType()}#OWNER#${owner}`,
          },
          ScanIndexForward: false,
          Limit: 100,
          ExclusiveStartKey: currentLastKey,
        };

        const result = await this.query(params);
        allCubes.push(...result.items);
        currentLastKey = result.lastKey;
      } while (currentLastKey);

      // Sort in memory
      const sorted = this.sortCubes(allCubes, sortBy, ascending);

      // Apply pagination
      return {
        items: sorted.slice(0, limit),
        lastKey: sorted.length > limit ? { offset: limit } : undefined,
      };
    }
  }

  /**
   * Gets cube cards from S3.
   */
  public async getCards(id: string): Promise<CubeCards> {
    try {
      const cards = await getObject(process.env.DATA_BUCKET!, `cube/${id}.json`);

      // If cards is null or doesn't have the expected structure, return default empty cards
      if (!cards || !cards.mainboard || !cards.maybeboard) {
        cloudwatch.info(`No cards found for cube: ${id}, returning empty default`);
        return {
          mainboard: [],
          maybeboard: [],
        };
      }

      const totalCardCount = cards.mainboard.length + cards.maybeboard.length;

      if (totalCardCount > CARD_LIMIT) {
        throw new Error(`Cannot load cube: ${id} - too many cards: ${totalCardCount}`);
      }

      // Add details to cards
      for (const [board, list] of Object.entries(cards)) {
        if (board !== 'id') {
          this.addDetails(list as any[]);
          for (let i = 0; i < (list as any[]).length; i++) {
            (list as any[])[i].index = i;
            (list as any[])[i].board = board;
          }
        }
      }
      return cards;
    } catch (e: any) {
      // If the error is NoSuchKey (file doesn't exist), return empty default
      if (e.name === 'NoSuchKey' || e.Code === 'NoSuchKey') {
        cloudwatch.info(`Cards file does not exist for cube: ${id}, returning empty default`);
        return {
          mainboard: [],
          maybeboard: [],
        };
      }

      cloudwatch.error(`Failed to load cards for cube: ${id} - ${e.message}`, e.stack);
      throw new Error(`Failed to load cards for cube: ${id} - ${e.message}`);
    }
  }

  /**
   * Lists all versions of cube cards from S3 with version IDs and timestamps.
   * Returns versions sorted by last modified date (newest first).
   *
   * @param id - The cube ID
   * @returns Array of version information including versionId, timestamp, and isLatest flag
   */
  public async listCubeCardsVersions(
    id: string,
  ): Promise<Array<{ versionId: string; timestamp: Date; isLatest: boolean }>> {
    try {
      const versions = await listObjectVersions(process.env.DATA_BUCKET!, `cube/${id}.json`);

      return versions.map((version) => ({
        versionId: version.versionId,
        timestamp: version.lastModified,
        isLatest: version.isLatest,
      }));
    } catch (e: any) {
      cloudwatch.error(`Failed to list versions for cube: ${id} - ${e.message}`, e.stack);
      throw new Error(`Failed to list versions for cube: ${id} - ${e.message}`);
    }
  }

  /**
   * Gets a specific version of cube cards from S3.
   *
   * @param id - The cube ID
   * @param versionId - The S3 version ID to retrieve
   * @returns The cube cards for the specified version, with details added
   */
  public async getCubeCardsVersion(id: string, versionId: string): Promise<CubeCards> {
    try {
      const cards = await getObjectVersion(process.env.DATA_BUCKET!, `cube/${id}.json`, versionId);

      // If cards is null or doesn't have the expected structure, return default empty cards
      if (!cards || !cards.mainboard || !cards.maybeboard) {
        cloudwatch.info(`No cards found for cube: ${id} version: ${versionId}, returning empty default`);
        return {
          mainboard: [],
          maybeboard: [],
        };
      }

      const totalCardCount = cards.mainboard.length + cards.maybeboard.length;

      if (totalCardCount > CARD_LIMIT) {
        throw new Error(`Cannot load cube: ${id} version: ${versionId} - too many cards: ${totalCardCount}`);
      }

      // Add details to cards
      for (const [board, list] of Object.entries(cards)) {
        if (board !== 'id') {
          this.addDetails(list as any[]);
          for (let i = 0; i < (list as any[]).length; i++) {
            (list as any[])[i].index = i;
            (list as any[])[i].board = board;
          }
        }
      }
      return cards;
    } catch (e: any) {
      // If the error is NoSuchKey (file doesn't exist), return empty default
      if (e.name === 'NoSuchKey' || e.Code === 'NoSuchKey') {
        cloudwatch.info(`Cards file does not exist for cube: ${id} version: ${versionId}, returning empty default`);
        return {
          mainboard: [],
          maybeboard: [],
        };
      }

      cloudwatch.error(`Failed to load cards for cube: ${id} version: ${versionId} - ${e.message}`, e.stack);
      throw new Error(`Failed to load cards for cube: ${id} version: ${versionId} - ${e.message}`);
    }
  }

  /**
   * Updates cube cards in S3 and metadata in DynamoDB.
   * Returns the new version number.
   */
  public async updateCards(id: string, newCards: CubeCards): Promise<number> {
    const nullCards = this.countNullCards(newCards.mainboard) + this.countNullCards(newCards.maybeboard);

    if (nullCards > 0) {
      throw new Error(`Cannot save cube: ${nullCards} null cards`);
    }

    const totalCards = newCards.mainboard.length + newCards.maybeboard.length;

    if (totalCards > CARD_LIMIT) {
      throw new Error(`Cannot save cube: too many cards (${totalCards}/${CARD_LIMIT})`);
    }

    // Get current cube metadata
    const cube = await this.getById(id);
    if (!cube) {
      throw new Error(`Cube not found: ${id}`);
    }

    // Update version and card count
    cube.cardCount = newCards.mainboard.length;
    cube.version = (cube.version || 0) + 1;
    cube.date = Date.now();

    const newVersion = cube.version;

    // Strip details from cards
    for (const [board, list] of Object.entries(newCards)) {
      if (board !== 'id') {
        this.stripDetails(list as any[]);
      }
    }

    // Update hash rows if cards changed - only if cube exists in DynamoDB
    // During migration, the cube might only exist in the old system
    const existingCubeInDynamo = await this.get({
      PK: this.partitionKey(cube),
      SK: this.itemType(),
    });

    if (existingCubeInDynamo) {
      const oldCards = await this.getCards(id);
      await this.updateHashRows(cube, oldCards, newCards);
    }
    // If cube doesn't exist in DynamoDB, updateHashRows will be handled by update() method

    // Save to S3 and DynamoDB
    await Promise.all([putObject(process.env.DATA_BUCKET!, `cube/${id}.json`, newCards), this.update(cube)]);

    return newVersion;
  }

  /**
   * Deletes a cube (metadata and cards).
   */
  public async deleteById(id: string): Promise<void> {
    const cube = await this.getById(id);
    if (!cube) {
      return;
    }

    // Get cards to calculate all hashes (including card-derived categories)
    const cards = await this.getCards(id);
    const metadataHashes = await this.getHashStringsWithCards(cube, cards);

    // Only include oracle ID hashes if MAINTAIN_CUBE_CARD_HASHES is enabled
    let allHashes = [...metadataHashes];
    if (process.env.MAINTAIN_CUBE_CARD_HASHES === 'true') {
      const oracleIds = this.getOracleIds(cards);
      const oracleHashes = await Promise.all(
        oracleIds.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
      );
      allHashes = [...metadataHashes, ...oracleHashes];
    }

    // Delete hash rows
    await this.deleteHashesBySK(this.partitionKey(cube), allHashes);

    // Delete cube metadata and cards
    await Promise.all([this.delete(cube), deleteObject(process.env.DATA_BUCKET!, `cube/${id}.json`)]);
  }

  /**
   * Creates a new cube.
   */
  public async putNewCube(cube: Cube, cards: CubeCards): Promise<void> {
    // Check if cube already exists
    const existing = await this.get({
      PK: this.partitionKey(cube),
      SK: this.itemType(),
    });

    if (existing) {
      throw new Error('This cube ID is already taken');
    }

    // Strip details from cards
    for (const [board, list] of Object.entries(cards)) {
      if (board !== 'id') {
        this.stripDetails(list as any[]);
      }
    }

    // Save metadata and cards first
    await Promise.all([this.put(cube), putObject(process.env.DATA_BUCKET!, `cube/${cube.id}.json`, cards)]);

    // Create hash rows after cube is saved (including card-derived category hashes)
    const metadataHashes = await this.getHashStringsWithCards(cube, cards);

    // Only include oracle ID hashes if MAINTAIN_CUBE_CARD_HASHES is enabled
    let allHashes = [...metadataHashes];
    if (process.env.MAINTAIN_CUBE_CARD_HASHES === 'true') {
      const oracleIds = this.getOracleIds(cards);
      const oracleHashes = await Promise.all(
        oracleIds.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
      );
      allHashes = [...metadataHashes, ...oracleHashes];
    }

    await this.writeHashes(this.partitionKey(cube), allHashes);
  }

  /**
   * Overrides update to handle hash row updates.
   */
  /**
   * Updates a cube's metadata.
   * @param item - The cube to update
   * @param options - Update options
   * @param options.skipTimestampUpdate - If true, does not update date/dateLastUpdated.
   *                                       Use this for counter updates (numDecks, following)
   *                                       that shouldn't trigger "recently edited" status.
   */
  public async update(item: Cube, options?: { skipTimestampUpdate?: boolean }): Promise<void> {
    // Get old cube to compare hashes
    const oldCube = await this.get({
      PK: this.partitionKey(item),
      SK: this.itemType(),
    });

    // Update timestamps only if not skipped
    if (!options?.skipTimestampUpdate) {
      const now = Date.now();
      item.date = now; // Legacy field
      item.dateLastUpdated = now;
    }

    if (!oldCube) {
      // Cube not found - this is an error
      throw new Error('Cube not found');
    }

    // Update hash rows if metadata changed
    const oldHashes = await this.getHashes(oldCube);
    const newHashes = await this.getHashes(item);

    const hashesToDelete = oldHashes.filter((hash) => !newHashes.includes(hash));
    const hashesToAdd = newHashes.filter((hash) => !oldHashes.includes(hash));

    if (hashesToDelete.length > 0) {
      await this.deleteHashesBySK(this.partitionKey(item), hashesToDelete);
    }

    if (hashesToAdd.length > 0) {
      await this.writeHashes(this.partitionKey(item), hashesToAdd);
    }

    // Update metadata
    await super.update(item);
  }

  /**
   * Update raw DynamoDB fields for a cube without hydration.
   * Useful for fixing data issues like null owners during migrations.
   *
   * @param cubeId - The cube ID to update
   * @param updates - Object with fields to update
   */
  public async updateRaw(cubeId: string, updates: Record<string, any>): Promise<void> {
    const PK = `CUBE#${cubeId}`;
    const SK = 'CUBE';

    // Build update expression
    const updateExpressionParts: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    let index = 0;
    for (const [key, value] of Object.entries(updates)) {
      const nameKey = `#field${index}`;
      const valueKey = `:value${index}`;
      updateExpressionParts.push(`${nameKey} = ${valueKey}`);
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[valueKey] = value;
      index += 1;
    }

    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK, SK },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
  }

  /**
   * Creates hash rows for a cube with GSI keys for sorting.
   * Each hash row has the hash as PK, cube ID as SK, and GSI keys for sorting.
   * GSI1: Sort by followers (popularity)
   * GSI2: Sort by name (alphabetical)
   * GSI3: Sort by card count
   * GSI4: Sort by date (most recent first)
   */
  protected async createHashRows(cube: Cube): Promise<any[]> {
    const hashStrings = await this.getHashStrings(cube);

    return hashStrings.map((hashString) => ({
      PK: `HASH#${this.partitionKey(cube)}`,
      SK: hashString,
      GSI1PK: hashString,
      GSI1SK: `FOLLOWERS#${String(cube.following.length).padStart(10, '0')}`,
      GSI2PK: hashString,
      GSI2SK: `NAME#${cube.name.toLowerCase()}`,
      GSI3PK: hashString,
      GSI3SK: `CARDS#${String(cube.cardCount).padStart(10, '0')}`,
      GSI4PK: hashString,
      GSI4SK: `DATE#${String(cube.dateLastUpdated).padStart(15, '0')}`,
      // Store metadata for quick access without needing to hydrate the full cube
      cubeName: cube.name,
      cubeFollowers: cube.following.length,
      cubeCardCount: cube.cardCount,
    }));
  }

  /**
   * Gets hash strings for a cube based on metadata.
   */
  protected async getHashStrings(cube: Cube): Promise<string[]> {
    const hashes: string[] = [];

    // generic hash
    hashes.push(await this.hash({ type: 'cube', value: 'all' }));

    // ShortId hash
    if (cube.shortId && cube.shortId.length > 0) {
      hashes.push(await this.hash({ type: 'shortid', value: cube.shortId }));
    }

    // Featured hash - only create hash if cube is featured
    if (cube.featured) {
      hashes.push(await this.hash({ type: 'featured', value: 'true' }));
    }

    // Category hashes
    if (cube.categoryOverride) {
      hashes.push(await this.hash({ type: 'category', value: cube.categoryOverride.toLowerCase() }));

      for (const prefix of cube.categoryPrefixes || []) {
        hashes.push(await this.hash({ type: 'category', value: prefix.toLowerCase() }));
      }
    }

    // Tag hashes
    for (const tag of cube.tags || []) {
      hashes.push(await this.hash({ type: 'tag', value: tag.toLowerCase() }));
    }

    // Keyword hashes (from cube name)
    if (cube.name) {
      const namewords = cube.name
        .replace(/[^\w\s]/gi, '')
        .toLowerCase()
        .split(' ')
        .filter((keyword: string) => keyword.length > 0);

      for (let i = 0; i < namewords.length; i++) {
        for (let j = i + 1; j < namewords.length + 1; j++) {
          const slice = namewords.slice(i, j);
          hashes.push(await this.hash({ type: 'keywords', value: slice.join(' ') }));
        }
      }
    }

    return Array.from(new Set(hashes));
  }

  /**
   * Gets hash strings for a cube including card-derived categories.
   * This should be used when we have access to the cube's cards and need complete hashes.
   */
  protected async getHashStringsWithCards(cube: Cube, cards: CubeCards): Promise<string[]> {
    const hashes = await this.getHashStrings(cube);

    // If there's no categoryOverride, we need to calculate categories from cards
    // and add those category hashes
    if (!cube.categoryOverride && cards.mainboard.length > 0) {
      const categories = this.calculateCategoriesFromCards(cards);
      for (const category of categories) {
        const categoryHash = await this.hash({ type: 'category', value: category.toLowerCase() });
        hashes.push(categoryHash);
      }
    }

    return Array.from(new Set(hashes));
  }

  /**
   * Calculates cube categories based on card legalities.
   * This mirrors the logic in setCubeType from cubefn.ts
   */
  private calculateCategoriesFromCards(cards: CubeCards): string[] {
    const FORMATS = ['Vintage', 'Legacy', 'Modern', 'Pioneer', 'Standard'];

    let pauper = true;
    let peasant = false;
    let type = FORMATS.length - 1;

    for (const card of cards.mainboard) {
      const cardDetails = cardFromId(card.cardID);

      // Check pauper legality
      if (pauper && cardDetails.legalities.Pauper !== 'legal' && cardDetails.legalities.Pauper !== 'banned') {
        pauper = false;
        peasant = true;
      }

      // Check peasant (uncommon or common in at least one printing)
      if (!pauper && peasant && cardDetails.rarity !== 'common' && cardDetails.rarity !== 'uncommon') {
        peasant = false;
      }

      // Find most restrictive legal format
      while (type > 0) {
        const legality = FORMATS[type];
        if (legality && cardDetails.legalities[legality] !== 'legal' && cardDetails.legalities[legality] !== 'banned') {
          type -= 1;
        } else {
          break;
        }
      }
    }

    const categories: string[] = [];

    // Add base format
    const baseFormat = FORMATS[type];
    if (baseFormat) {
      categories.push(baseFormat);
    }

    // Add modifiers
    if (pauper) {
      categories.push('Pauper');
    } else if (peasant) {
      categories.push('Peasant');
    }

    return categories;
  }

  /**
   * Gets hashes for a cube (for backward compatibility with base class).
   */
  protected async getHashes(cube: Cube): Promise<string[]> {
    return this.getHashStrings(cube);
  }

  /**
   * Overrides writeHashes to use hash rows with GSI keys.
   */
  protected async writeHashes(itemPK: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    // Get the cube to create proper hash rows with metadata
    const cube = await this.get({
      PK: itemPK,
      SK: this.itemType(),
    });

    if (!cube) {
      throw new Error('Cube not found when writing hashes');
    }

    // Safely access fields that might be undefined
    const cubeName = cube.name;
    const cubeFollowers = cube.following.length;
    const cubeCardCount = cube.cardCount || 0;
    const cubeDate = cube.dateLastUpdated || cube.date || Date.now();

    // Use NEW hash row structure: PK = HASH#CUBE#{id}, SK = hashString
    const hashPK = `HASH#${itemPK}`;

    const hashRows = hashes.map((hashString) => ({
      PK: hashPK,
      SK: hashString,
      GSI1PK: hashString,
      GSI1SK: `FOLLOWERS#${String(cubeFollowers).padStart(10, '0')}`,
      GSI2PK: hashString,
      GSI2SK: `NAME#${cubeName.toLowerCase()}`,
      GSI3PK: hashString,
      GSI3SK: `CARDS#${String(cubeCardCount).padStart(10, '0')}`,
      GSI4PK: hashString,
      GSI4SK: `DATE#${String(cubeDate).padStart(15, '0')}`,
      cubeName: cubeName,
      cubeFollowers: cubeFollowers,
      cubeCardCount: cubeCardCount,
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
   * Updates hash rows when cards change (oracle hashes and category hashes).
   */
  private async updateHashRows(cube: Cube, oldCards: CubeCards, newCards: CubeCards): Promise<void> {
    let hashesToDelete: string[] = [];
    let hashesToAdd: string[] = [];

    // Handle oracle hash changes only if MAINTAIN_CUBE_CARD_HASHES is enabled
    if (process.env.MAINTAIN_CUBE_CARD_HASHES === 'true') {
      const oldOracleIds = this.getOracleIds(oldCards);
      const newOracleIds = this.getOracleIds(newCards);

      const oraclesToDelete = oldOracleIds.filter((id) => !newOracleIds.includes(id));
      const oraclesToAdd = newOracleIds.filter((id) => !oldOracleIds.includes(id));

      const oracleHashesToDelete = await Promise.all(
        oraclesToDelete.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
      );

      const oracleHashesToAdd = await Promise.all(
        oraclesToAdd.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
      );

      hashesToDelete = oracleHashesToDelete;
      hashesToAdd = oracleHashesToAdd;
    }

    // Handle category hash changes (if cube doesn't have categoryOverride)
    // Categories are derived from cards, so they might change when cards change
    if (!cube.categoryOverride) {
      const oldCategories = this.calculateCategoriesFromCards(oldCards);
      const newCategories = this.calculateCategoriesFromCards(newCards);

      const categoriesToDelete = oldCategories.filter((cat) => !newCategories.includes(cat));
      const categoriesToAdd = newCategories.filter((cat) => !oldCategories.includes(cat));

      const categoryHashesToDelete = await Promise.all(
        categoriesToDelete.map((category) => this.hash({ type: 'category', value: category.toLowerCase() })),
      );

      const categoryHashesToAdd = await Promise.all(
        categoriesToAdd.map((category) => this.hash({ type: 'category', value: category.toLowerCase() })),
      );

      hashesToDelete.push(...categoryHashesToDelete);
      hashesToAdd.push(...categoryHashesToAdd);
    }

    if (hashesToDelete.length > 0) {
      await this.deleteHashesBySK(this.partitionKey(cube), hashesToDelete);
    }

    if (hashesToAdd.length > 0) {
      await this.writeHashes(this.partitionKey(cube), hashesToAdd);
    }
  }

  /**
   * Gets unique oracle IDs from cube cards.
   */
  private getOracleIds(cards: CubeCards): string[] {
    const oracleIds: string[] = [];

    for (const card of cards.mainboard) {
      const oracle = cardFromId(card.cardID)?.oracle_id;
      if (oracle) {
        oracleIds.push(oracle);
      }
    }

    return Array.from(new Set(oracleIds));
  }

  /**
   * Adds card details to cards for display.
   */
  private addDetails(cards: any[]): void {
    for (let i = 0; i < cards.length; i++) {
      if (cards[i]) {
        cards[i].details = {
          ...cardFromId(cards[i].cardID),
        };
        cards[i].index = i;
      } else {
        cards[i] = {
          details: getPlaceholderCard(''),
          index: i,
        };
      }
    }
  }

  /**
   * Strips card details before storage.
   */
  private stripDetails(cards: any[]): void {
    cards.forEach((card: any) => {
      delete card.details;
      delete card.index;
      delete card.board;
      delete card.editIndex;

      if (card.tags) {
        card.tags = card.tags.map((tag: any) => {
          if (typeof tag === 'object') {
            return tag.text;
          }
          return tag;
        });
      }
    });
  }

  /**
   * Counts null cards in an array.
   */
  private countNullCards(arr: any[]): number {
    const serialized = JSON.stringify(arr);
    const parsed = JSON.parse(serialized);
    return parsed.filter((card: any) => card === null).length;
  }

  /**
   * Queries featured cubes with sorting.
   * Note: Only featured cubes have hash rows, so this only returns featured=true cubes.
   */
  public async queryByFeatured(
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'featured', value: 'true' });

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes by category with sorting.
   */
  public async queryByCategory(
    category: string,
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'category', value: category });

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes by tag with sorting.
   */
  public async queryByTag(
    tag: string,
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'tag', value: tag.toLowerCase() });

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes by keyword(s) with sorting.
   * Normalizes the search keywords to match how cube names are stored.
   */
  public async queryByKeyword(
    keywords: string,
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    // Normalize keywords the same way we normalize cube names when storing hashes
    const normalizedKeywords = keywords
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();

    const hashString = await this.hash({ type: 'keywords', value: normalizedKeywords });

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes by oracle ID (cards containing this card) with sorting.
   */
  public async queryByOracleId(
    oracleId: string,
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'oracle', value: oracleId });

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries all public cubes using the global 'cube:all' hash with sorting and pagination.
   * This is the preferred method for getting all cubes with full sort support.
   */
  public async queryAllCubes(
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'cube', value: 'all' });
    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes that match ALL provided hash criteria (intersection).
   * Uses a two-phase approach:
   * 1. Query the first hash to get a page of candidates (using GSI for sorting)
   * 2. Load all hashes for those candidates and filter by remaining criteria
   * 3. Apply card count filter in memory if provided
   * 4. Return results once we have hits, or continue up to 10 pages
   *
   * @param hashes - Array of hash strings to query. First hash should be most restrictive.
   * @param sortBy - How to sort the results from the first hash query (uses appropriate GSI)
   * @param ascending - Sort direction
   * @param lastKey - Pagination key from previous query
   * @param cardCountFilter - Optional filter for card count { operator: 'eq' | 'gt' | 'lt', value: number }
   * @returns Query result with cubes and pagination key
   * @throws Error if dual write mode is enabled (old data model doesn't support this operation)
   */
  public async queryByMultipleHashes(
    hashes: string[],
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    cardCountFilter?: { operator: 'eq' | 'gt' | 'lt'; value: number },
  ): Promise<QueryResult> {
    if (hashes.length === 0) {
      return { items: [] };
    }

    if (hashes.length === 1) {
      // Single hash - use the optimized single-hash query
      const [type, value] = hashes[0]!.split(':');
      if (!type || !value) {
        return { items: [] };
      }
      const hashString = await this.hash({ type, value });
      return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey);
    }

    // Convert all hash strings
    const hashStrings = await Promise.all(
      hashes.map(async (hash) => {
        const [type, value] = hash.split(':');
        if (!type || !value) {
          return null;
        }
        return this.hash({ type, value });
      }),
    );

    // Filter out invalid hashes
    const validHashStrings = hashStrings.filter((h): h is string => h !== null);
    if (validHashStrings.length === 0) {
      return { items: [] };
    }

    // First hash is the primary query (should be most restrictive)
    const primaryHash = validHashStrings[0]!;
    // Remaining hashes to filter by
    const filterHashes = new Set(validHashStrings.slice(1));

    const MAX_PAGES = 10;
    const PAGE_SIZE = 100;
    let pagesChecked = 0;
    let currentLastKey = lastKey;
    const matchingCubes: Cube[] = [];

    // Keep querying pages until we find matches or hit the page limit
    while (pagesChecked < MAX_PAGES && matchingCubes.length === 0) {
      pagesChecked += 1;

      // Query one page of candidates from the first hash using the appropriate GSI for sorting
      // No limit specified - use DynamoDB's default max page size (1MB of data)
      const candidatesResult = await this.queryByHashForIdsOnly(
        primaryHash,
        sortBy,
        ascending,
        currentLastKey,
        PAGE_SIZE,
      );

      if (candidatesResult.cubeIds.length === 0) {
        // No more results
        break;
      }

      // Load all hashes for each candidate cube
      const candidateHashes = await Promise.all(
        candidatesResult.cubeIds.map(async (cubeId) => {
          const result = await this.getHashesForCube(cubeId);
          return {
            cubeId,
            hashes: new Set(result.hashes.map((h) => h.hash)),
          };
        }),
      );

      // Filter candidates that have all required hashes
      const matchingIds = candidateHashes
        .filter((candidate) => {
          // Check if this cube has all the filter hashes
          for (const requiredHash of filterHashes) {
            if (!candidate.hashes.has(requiredHash)) {
              return false;
            }
          }
          return true;
        })
        .map((candidate) => candidate.cubeId);

      if (matchingIds.length > 0) {
        // Found matches! Hydrate cubes
        const cubes = await this.batchGet(matchingIds);

        // Apply card count filter in memory if provided
        let filteredCubes = cubes;
        if (cardCountFilter) {
          filteredCubes = cubes.filter((cube) => {
            const count = cube.cardCount || 0;
            switch (cardCountFilter.operator) {
              case 'eq':
                return count === cardCountFilter.value;
              case 'gt':
                return count > cardCountFilter.value;
              case 'lt':
                return count < cardCountFilter.value;
              default:
                return true;
            }
          });
        }

        matchingCubes.push(...filteredCubes);

        // Return with pagination key for next query
        // Note: Results are already sorted by the GSI query
        return {
          items: matchingCubes,
          lastKey: candidatesResult.lastKey,
        };
      }

      // No matches in this page, continue to next page
      currentLastKey = candidatesResult.lastKey;

      if (!currentLastKey) {
        // No more pages to check
        break;
      }
    }

    // If we exhausted pages without finding anything, provide helpful error
    if (pagesChecked >= MAX_PAGES && matchingCubes.length === 0) {
      throw new Error(
        `Search query too expensive: No matches found after checking ${MAX_PAGES} pages. ` +
          `Tip: Move the most restrictive criteria to the front of the query to improve performance.`,
      );
    }

    // Return whatever we found (might be empty)
    return {
      items: matchingCubes,
      lastKey: undefined,
    };
  }

  /**
   * Sorts cubes according to the specified sort order.
   */
  private sortCubes(cubes: Cube[], sortBy: SortOrder, ascending: boolean): Cube[] {
    const sorted = [...cubes];

    switch (sortBy) {
      case 'popularity':
        sorted.sort((a, b) => {
          const diff = a.following.length - b.following.length;
          return ascending ? diff : -diff;
        });
        break;
      case 'alphabetical':
        sorted.sort((a, b) => {
          const diff = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          return ascending ? diff : -diff;
        });
        break;
      case 'cards':
        sorted.sort((a, b) => {
          const diff = a.cardCount - b.cardCount;
          return ascending ? diff : -diff;
        });
        break;
      case 'date':
        sorted.sort((a, b) => {
          const diff = a.dateLastUpdated - b.dateLastUpdated;
          return ascending ? diff : -diff;
        });
        break;
    }

    return sorted;
  }

  /**
   * Helper method to query by hash with sorting using GSI.
   */
  private async queryByHashWithSort(
    hash: string,
    sortBy: SortOrder,
    ascending: boolean,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<QueryResult> {
    let indexName: string;
    let gsiPK: string;

    switch (sortBy) {
      case 'popularity':
        indexName = 'GSI1';
        gsiPK = 'GSI1PK';
        break;
      case 'alphabetical':
        indexName = 'GSI2';
        gsiPK = 'GSI2PK';
        break;
      case 'cards':
        indexName = 'GSI3';
        gsiPK = 'GSI3PK';
        break;
      case 'date':
        indexName = 'GSI4';
        gsiPK = 'GSI4PK';
        break;
      default:
        indexName = 'GSI1';
        gsiPK = 'GSI1PK';
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: `${gsiPK} = :hash`,
      ExpressionAttributeValues: {
        ':hash': hash,
      },
      ScanIndexForward: ascending,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    // Query hash rows
    const queryResult = await this.dynamoClient.send(new QueryCommand(params));

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return { items: [] };
    }

    // Extract cube IDs from hash rows
    const cubeIds = queryResult.Items.map((item) => {
      // PK contains the cube partition key: HASH#CUBE#{id}
      const pk = item.PK as string;
      // Remove 'HASH#CUBE#' prefix to get the cube ID
      return pk.replace('HASH#CUBE#', '');
    });

    // Fetch cubes
    const cubes = await this.batchGet(cubeIds);

    return {
      items: cubes,
      lastKey: queryResult.LastEvaluatedKey || undefined,
    };
  }

  /**
   * Helper method to query by hash and return only cube IDs (no hydration).
   * Used by queryByMultipleHashes to avoid hydrating cubes that will be filtered out.
   */
  private async queryByHashForIdsOnly(
    hash: string,
    sortBy: SortOrder,
    ascending: boolean,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<{ cubeIds: string[]; lastKey?: Record<string, any> }> {
    let indexName: string;
    let gsiPK: string;

    switch (sortBy) {
      case 'popularity':
        indexName = 'GSI1';
        gsiPK = 'GSI1PK';
        break;
      case 'alphabetical':
        indexName = 'GSI2';
        gsiPK = 'GSI2PK';
        break;
      case 'cards':
        indexName = 'GSI3';
        gsiPK = 'GSI3PK';
        break;
      case 'date':
        indexName = 'GSI4';
        gsiPK = 'GSI4PK';
        break;
      default:
        indexName = 'GSI1';
        gsiPK = 'GSI1PK';
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: `${gsiPK} = :hash`,
      ExpressionAttributeValues: {
        ':hash': hash,
      },
      ScanIndexForward: ascending,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    try {
      // Query hash rows
      const queryResult = await this.dynamoClient.send(new QueryCommand(params));

      if (!queryResult.Items || queryResult.Items.length === 0) {
        return { cubeIds: [] };
      }

      // Extract cube IDs from hash rows (no hydration)
      // Filter out old format rows (where PK is a 64-char hex hash instead of HASH#CUBE#{id})
      const cubeIds = queryResult.Items.filter((item) => {
        const pk = item.PK as string;
        // Only include new format rows that start with 'HASH#CUBE#'
        return pk && pk.startsWith('HASH#CUBE#');
      }).map((item) => {
        // PK contains the cube partition key: HASH#CUBE#{id}
        const pk = item.PK as string;
        if (!pk) {
          console.error('[queryByHashForIdsOnly] Item missing PK:', item);
          throw new Error('Hash row missing PK field');
        }
        // Remove 'HASH#CUBE#' prefix to get the cube ID
        return pk.replace('HASH#CUBE#', '');
      });

      return {
        cubeIds,
        lastKey: queryResult.LastEvaluatedKey || undefined,
      };
    } catch (error: any) {
      console.error('[queryByHashForIdsOnly] Error during query:', {
        error: error.message,
        stack: error.stack,
        params,
      });
      throw error;
    }
  }

  // =====================
  // CUBE ANALYTICS METHODS
  // =====================

  /**
   * Gets analytics for a specific cube from S3.
   *
   * @param cubeId - The ID of the cube to get analytics for
   * @returns The cube analytics, or an empty object if not found
   */
  public async getAnalytics(cubeId: string): Promise<CubeAnalytic | Record<string, never>> {
    try {
      return await getObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
    } catch {
      // Return empty object if analytics don't exist
      return {};
    }
  }

  /**
   * Updates analytics for a single cube in S3.
   *
   * @param cubeId - The ID of the cube
   * @param analytic - The analytics data to save
   */
  public async putAnalytics(cubeId: string, analytic: CubeAnalytic): Promise<void> {
    await putObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`, analytic);
  }

  /**
   * Batch updates analytics for multiple cubes in S3.
   * Processes all cubes in parallel for efficiency.
   *
   * @param analytics - Dictionary mapping cube IDs to their analytics
   */
  public async batchPutAnalytics(analytics: { [cubeId: string]: CubeAnalytic }): Promise<void> {
    await Promise.all(
      Object.keys(analytics).map(async (cubeId) => {
        await putObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`, analytics[cubeId]);
      }),
    );
  }

  /**
   * Deletes analytics for a specific cube from S3.
   *
   * @param cubeId - The ID of the cube to delete analytics for
   */
  public async deleteAnalytics(cubeId: string): Promise<void> {
    await deleteObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
  }

  /**
   * Checks if analytics exist for a specific cube.
   *
   * @param cubeId - The ID of the cube to check
   * @returns True if analytics exist, false otherwise
   */
  public async analyticsExist(cubeId: string): Promise<boolean> {
    try {
      const result = await getObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
      return Object.keys(result).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gets all hash rows for a specific cube.
   * This is useful for cleanup/sweeper operations to verify or remove stale hashes.
   *
   * @param cubeId - The ID of the cube to get hashes for
   * @returns Promise with array of hash strings and their metadata
   */
  public async getHashesForCube(cubeId: string): Promise<{
    hashes: Array<{
      hash: string;
      cubeName?: string;
      cubeFollowers?: number;
      cubeCardCount?: number;
    }>;
    lastKey?: Record<string, any>;
  }> {
    const cubePK = this.typedKey(cubeId);
    const hashPK = `HASH#${cubePK}`;

    const queryResult = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': hashPK,
        },
      }),
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return { hashes: [] };
    }

    const hashes = queryResult.Items.map((item: any) => ({
      hash: item.SK as string,
      cubeName: item.cubeName,
      cubeFollowers: item.cubeFollowers,
      cubeCardCount: item.cubeCardCount,
    }));

    return {
      hashes,
      lastKey: queryResult.LastEvaluatedKey || undefined,
    };
  }

  /**
   * Deletes all hash rows for a specific cube.
   * This is useful for cleanup operations when removing a cube or resetting its hashes.
   *
   * @param cubeId - The ID of the cube to delete hash rows for
   * @returns Promise with the number of hash rows deleted
   */
  public async deleteHashRowsForCube(cubeId: string): Promise<number> {
    // Get all hash rows for this cube
    const hashesResult = await this.getHashesForCube(cubeId);

    if (hashesResult.hashes.length === 0) {
      return 0;
    }

    // Extract just the hash strings
    const hashStrings = hashesResult.hashes.map((h) => h.hash);

    // Delete all hash rows
    const cubePK = this.typedKey(cubeId);
    await this.deleteHashesBySK(cubePK, hashStrings);

    return hashStrings.length;
  }

  /**
   * Repairs hash rows for a cube by comparing current hashes with expected hashes
   * and writing the delta (removing stale hashes and adding missing ones).
   * This includes both metadata hashes and card (oracle) hashes.
   * This is useful for cleanup operations when hash logic changes or data becomes inconsistent.
   *
   * @param cubeId - The ID of the cube to repair hashes for
   * @param fixOwner - Optional owner ID to fix if cube has null/undefined owner
   * @returns Promise with repair statistics
   */
  public async repairHashes(
    cubeId: string,
    fixOwner?: string,
  ): Promise<{
    added: number;
    removed: number;
    unchanged: number;
    ownerFixed: boolean;
  }> {
    // Get the cube
    const cube = await this.getById(cubeId);

    if (!cube) {
      throw new Error(`Cube not found: ${cubeId}`);
    }

    let ownerFixed = false;

    // Fix owner if needed - check for null, undefined, or empty string owner ID
    const ownerId = typeof cube.owner === 'string' ? cube.owner : cube.owner?.id;
    if (fixOwner && (!ownerId || ownerId === null || ownerId === undefined)) {
      await this.updateRaw(cubeId, { owner: fixOwner });
      // Update the owner in the cube object for hash calculation
      cube.owner = fixOwner as any;
      ownerFixed = true;
    }

    // Get current hash rows
    const currentHashesResult = await this.getHashesForCube(cubeId);
    const currentHashes = new Set(currentHashesResult.hashes.map((h) => h.hash));

    // Calculate expected hashes (metadata + oracle + card-derived categories)
    const expectedHashes = new Set<string>();

    // Get cards first so we can calculate card-derived hashes
    const cards = await this.getCards(cubeId);

    // Add metadata hashes (including card-derived categories)
    const metadataHashes = await this.getHashStringsWithCards(cube, cards);
    metadataHashes.forEach((hash) => expectedHashes.add(hash));

    // Add oracle hashes from cards only if MAINTAIN_CUBE_CARD_HASHES is enabled
    if (process.env.MAINTAIN_CUBE_CARD_HASHES === 'true') {
      const oracleIds = this.getOracleIds(cards);
      const oracleHashes = await Promise.all(
        oracleIds.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
      );
      oracleHashes.forEach((hash) => expectedHashes.add(hash));
    }

    // Find hashes to add and remove
    const hashesToAdd = Array.from(expectedHashes).filter((hash) => !currentHashes.has(hash));
    const hashesToRemove = Array.from(currentHashes).filter((hash) => !expectedHashes.has(hash));
    const unchanged = Array.from(expectedHashes).filter((hash) => currentHashes.has(hash));

    // Remove stale hashes
    if (hashesToRemove.length > 0) {
      await this.deleteHashesBySK(this.partitionKey(cube), hashesToRemove);
    }

    // Add missing hashes
    if (hashesToAdd.length > 0) {
      await this.writeHashes(this.partitionKey(cube), hashesToAdd);
    }

    return {
      added: hashesToAdd.length,
      removed: hashesToRemove.length,
      unchanged: unchanged.length,
      ownerFixed,
    };
  }

  /**
   * Deletes hash rows by their SK (hash string) values.
   * This is used by repairHashes to remove specific hash rows.
   *
   * @param itemPK - The partition key of the cube (CUBE#{id})
   * @param hashes - The hash strings (SK values) to delete
   */
  private async deleteHashesBySK(itemPK: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    const hashPK = `HASH#${itemPK}`;
    const hashRows: HashRow[] = hashes.map((hash) => ({
      PK: hashPK,
      SK: hash,
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
}
