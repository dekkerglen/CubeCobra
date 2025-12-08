/**
 * CubeDynamoDao - Data Access Object for Cube entities in a single-table DynamoDB design.
 *
 * STORAGE STRATEGY:
 * - Cube metadata: Stored in DynamoDB with PK = CUBE#{id}, SK = CUBE
 * - Cube cards: Stored in S3 at cube/{id}.json
 * - Hash rows: Stored with PK = hash, SK = CUBE#{id} for search functionality
 *
 * QUERY PATTERNS:
 * - getById(id): Get cube by ID or shortId
 * - queryByOwner(ownerId, sortBy): Get cubes by owner with sorting
 * - queryByVisibility(visibility, sortBy): Get cubes by visibility with sorting
 * - queryByFeatured(sortBy): Get featured cubes with sorting
 * - queryByCategory(category, sortBy): Get cubes by category with sorting
 * - queryByTag(tag, sortBy): Get cubes by tag with sorting
 * - queryByKeyword(keywords, sortBy): Get cubes by name keywords with sorting
 * - queryByOracleId(oracleId, sortBy): Get cubes containing a specific card
 * - queryByMultipleHashes(hashes, sortBy, cardCountFilter): Get cubes matching ALL hash criteria (max 10 hashes)
 *   with optional card count filtering (eq/gt/lt)
 *
 * SORTING OPTIONS (for hash-based queries):
 * - 'popularity': Sort by follower count (default)
 * - 'alphabetical': Sort by cube name
 * - 'cards': Sort by card count
 * - 'date': Sort by last updated date
 *
 * HASH ROW STRUCTURE:
 * Hash rows enable efficient search with sortable attributes:
 * - PK: hash string (e.g., "shortid:mycube", "tag:vintage", "oracle:abc123")
 * - SK: CUBE#{cubeId}
 * - GSI1: Hash + followers count for popularity sorting
 * - GSI2: Hash + cube name for alphabetical sorting
 * - GSI3: Hash + card count for size sorting
 * - GSI4: Hash + last updated date for recency sorting
 *
 * DUAL WRITE MODE:
 * Supports gradual migration from old cube model by writing to both systems
 * when dualWriteEnabled flag is set.
 */

import { DynamoDBDocumentClient, QueryCommandInput, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import Cube from '@utils/datatypes/Cube';
import { CubeCards } from '@utils/datatypes/Cube';
import { CardStatus } from '@utils/datatypes/Card';
import User from '@utils/datatypes/User';
import { normalizeDraftFormatSteps } from '@utils/draftutil';
import _ from 'lodash';
import { cardFromId, getPlaceholderCard } from 'serverutils/carddb';
import cloudwatch from 'serverutils/cloudwatch';
import { getImageData } from 'serverutils/imageutil';

import { deleteObject, getObject, putObject } from '../s3client';
import CubeHashModel from '../models/cubeHash';
import CubeModel from '../models/cube';
import UserModel from '../models/user';
import { BaseDynamoDao } from './BaseDynamoDao';

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

export class CubeDynamoDao extends BaseDynamoDao<Cube, UnhydratedCube> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
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
   * GSI2: Query by visibility and date
   * GSI3: Not used by cube metadata
   * GSI4: Not used by cube metadata
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
    return {
      GSI1PK: item.owner?.id ? `${this.itemType()}#OWNER#${item.owner.id}` : undefined,
      GSI1SK: item.dateLastUpdated ? `DATE#${item.dateLastUpdated}` : undefined,
      GSI2PK: item.visibility ? `${this.itemType()}#VISIBILITY#${item.visibility}` : undefined,
      GSI2SK: item.dateLastUpdated ? `DATE#${item.dateLastUpdated}` : undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
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
    const owner = await UserModel.getById(item.owner);
    const image = getImageData(item.imageName);

    const draftFormats = item.formats || [];
    // Correct bad custom draft formats on load
    for (let format of draftFormats) {
      format = normalizeDraftFormatSteps(format);
    }

    return {
      ...item,
      owner: owner!,
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

    const ownerIds = items.filter((item) => item.owner).map((item) => item.owner);
    const owners = ownerIds.length > 0 ? await UserModel.batchGet(ownerIds) : [];

    return items.map((item) => {
      const owner = owners.find((o: User) => o.id === item.owner);
      const image = getImageData(item.imageName);

      const draftFormats = item.formats || [];
      // Correct bad custom draft formats on load
      for (let format of draftFormats) {
        format = normalizeDraftFormatSteps(format);
      }

      return {
        ...item,
        owner: owner!,
        image,
      } as Cube;
    });
  }

  /**
   * Gets a cube by ID (supports both full ID and shortId).
   */
  public async getById(id: string): Promise<Cube | null | undefined> {
    if (this.dualWriteEnabled) {
      return CubeModel.getById(id);
    }

    // Try by full ID first
    const byId = await this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });

    if (byId) {
      return byId;
    }

    // Try by shortId using hash lookup
    const byShortId = await CubeHashModel.getSortedByName(CubeHashModel.getShortIdHash(id));
    if (byShortId.items && byShortId.items.length > 0) {
      const cubeId = byShortId.items[0]!.cube;
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
    if (this.dualWriteEnabled) {
      return CubeModel.batchGet(ids);
    }

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
    if (this.dualWriteEnabled) {
      return CubeModel.getByOwner(owner, lastKey);
    }

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
   * Queries cubes by visibility with sorting and pagination.
   */
  public async queryByVisibility(
    visibility: string,
    sortBy: SortOrder = 'date',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<QueryResult> {
    if (this.dualWriteEnabled) {
      return CubeModel.getByVisibility(visibility, lastKey, limit);
    }

    // For visibility queries, we can only sort by date using GSI2
    // For other sorts, we need to fetch all and sort in memory
    if (sortBy === 'date') {
      const params: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :visibility',
        ExpressionAttributeValues: {
          ':visibility': `${this.itemType()}#VISIBILITY#${visibility}`,
        },
        ScanIndexForward: ascending,
        Limit: limit,
        ExclusiveStartKey: lastKey,
      };

      return this.query(params);
    } else {
      // Fetch all cubes for this visibility and sort in memory
      const allCubes: Cube[] = [];
      let currentLastKey: Record<string, any> | undefined = undefined;

      do {
        const params: QueryCommandInput = {
          TableName: this.tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :visibility',
          ExpressionAttributeValues: {
            ':visibility': `${this.itemType()}#VISIBILITY#${visibility}`,
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
      cloudwatch.error(`Failed to load cards for cube: ${id} - ${e.message}`, e.stack);
      throw new Error(`Failed to load cards for cube: ${id} - ${e.message}`);
    }
  }

  /**
   * Updates cube cards in S3 and metadata in DynamoDB.
   */
  public async updateCards(id: string, newCards: CubeCards): Promise<void> {
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

    if (this.dualWriteEnabled) {
      await CubeModel.updateCards(id, newCards);
    }
  }

  /**
   * Deletes a cube (metadata and cards).
   */
  public async deleteById(id: string): Promise<void> {
    if (this.dualWriteEnabled) {
      await CubeModel.deleteById(id);
    }

    const cube = await this.getById(id);
    if (!cube) {
      return;
    }

    // Delete hash rows
    const hashes = await this.getHashes(cube);
    await this.deleteHashes(this.partitionKey(cube), hashes);

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

    if (this.dualWriteEnabled) {
      await CubeModel.putNewCube(this.dehydrateItem(cube));
      await CubeModel.putCards(cards);
    }

    // Strip details from cards
    for (const [board, list] of Object.entries(cards)) {
      if (board !== 'id') {
        this.stripDetails(list as any[]);
      }
    }

    // Create hash rows
    const hashes = await this.getHashes(cube);
    await this.writeHashes(this.partitionKey(cube), hashes);

    // Save metadata and cards
    await Promise.all([this.put(cube), putObject(process.env.DATA_BUCKET!, `cube/${cube.id}.json`, cards)]);
  }

  /**
   * Overrides update to handle hash row updates.
   */
  public async update(item: Cube): Promise<void> {
    if (this.dualWriteEnabled) {
      await CubeModel.update(this.dehydrateItem(item));
    }

    // Get old cube to compare hashes
    const oldCube = await this.get({
      PK: this.partitionKey(item),
      SK: this.itemType(),
    });

    // Update timestamps
    const now = Date.now();
    item.date = now; // Legacy field
    item.dateLastUpdated = now;

    if (!oldCube) {
      // Cube not migrated yet - create it in DynamoDB
      if (this.dualWriteEnabled) {
        // In dual write mode, just create the cube without error
        await this.put(item);
        // Create initial hash rows
        const hashes = await this.getHashes(item);
        await this.writeHashes(this.partitionKey(item), hashes);
        return;
      } else {
        // Not in dual write mode, this is a real error
        throw new Error('Cube not found');
      }
    }

    // Update hash rows if metadata changed
    const oldHashes = await this.getHashes(oldCube);
    const newHashes = await this.getHashes(item);

    const hashesToDelete = oldHashes.filter((hash) => !newHashes.includes(hash));
    const hashesToAdd = newHashes.filter((hash) => !oldHashes.includes(hash));

    if (hashesToDelete.length > 0) {
      await this.deleteHashes(this.partitionKey(item), hashesToDelete);
    }

    if (hashesToAdd.length > 0) {
      await this.writeHashes(this.partitionKey(item), hashesToAdd);
    }

    // Update metadata
    await super.update(item);
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
      PK: hashString,
      SK: this.partitionKey(cube),
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
      hashes.push(await this.hash({ type: 'category', value: cube.categoryOverride }));

      for (const prefix of cube.categoryPrefixes || []) {
        hashes.push(await this.hash({ type: 'category', value: prefix.toLowerCase() }));
      }
    }

    // Tag hashes
    for (const tag of cube.tags || []) {
      hashes.push(await this.hash({ type: 'tag', value: tag.toLowerCase() }));
    }

    // Keyword hashes (from cube name)
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

    return Array.from(new Set(hashes));
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

    const hashRows = hashes.map((hashString) => ({
      PK: hashString,
      SK: itemPK,
      GSI1PK: hashString,
      GSI1SK: `FOLLOWERS#${String(cube.following.length).padStart(10, '0')}`,
      GSI2PK: hashString,
      GSI2SK: `NAME#${cube.name.toLowerCase()}`,
      GSI3PK: hashString,
      GSI3SK: `CARDS#${String(cube.cardCount).padStart(10, '0')}`,
      GSI4PK: hashString,
      GSI4SK: `DATE#${String(cube.date).padStart(15, '0')}`,
      cubeName: cube.name,
      cubeFollowers: cube.following.length,
      cubeCardCount: cube.cardCount,
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
   * Updates hash rows when cards change (oracle hashes).
   */
  private async updateHashRows(cube: Cube, oldCards: CubeCards, newCards: CubeCards): Promise<void> {
    const oldOracleIds = this.getOracleIds(oldCards);
    const newOracleIds = this.getOracleIds(newCards);

    const oraclesToDelete = oldOracleIds.filter((id) => !newOracleIds.includes(id));
    const oraclesToAdd = newOracleIds.filter((id) => !oldOracleIds.includes(id));

    const hashesToDelete = await Promise.all(
      oraclesToDelete.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
    );

    const hashesToAdd = await Promise.all(
      oraclesToAdd.map((oracleId) => this.hash({ type: 'oracle', value: oracleId })),
    );

    if (hashesToDelete.length > 0) {
      await this.deleteHashes(this.partitionKey(cube), hashesToDelete);
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
    limit: number = 36,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'featured', value: 'true' });

    if (this.dualWriteEnabled) {
      const result = await CubeHashModel.query(hashString, ascending, lastKey, this.mapSortOrder(sortBy), limit);
      const cubeIds = result.items.map((item) => item.cube);
      const cubes = await this.batchGet(cubeIds);
      return {
        items: cubes,
        lastKey: result.lastKey,
      };
    }

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
    limit: number = 36,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'category', value: category });

    if (this.dualWriteEnabled) {
      const result = await CubeHashModel.query(hashString, ascending, lastKey, this.mapSortOrder(sortBy), limit);
      const cubeIds = result.items.map((item) => item.cube);
      const cubes = await this.batchGet(cubeIds);
      return {
        items: cubes,
        lastKey: result.lastKey,
      };
    }

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
    limit: number = 36,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'tag', value: tag.toLowerCase() });

    if (this.dualWriteEnabled) {
      const result = await CubeHashModel.query(hashString, ascending, lastKey, this.mapSortOrder(sortBy), limit);
      const cubeIds = result.items.map((item) => item.cube);
      const cubes = await this.batchGet(cubeIds);
      return {
        items: cubes,
        lastKey: result.lastKey,
      };
    }

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes by keyword(s) with sorting.
   */
  public async queryByKeyword(
    keywords: string,
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'keywords', value: keywords.toLowerCase() });

    if (this.dualWriteEnabled) {
      const result = await CubeHashModel.query(hashString, ascending, lastKey, this.mapSortOrder(sortBy), limit);
      const cubeIds = result.items.map((item) => item.cube);
      const cubes = await this.batchGet(cubeIds);
      return {
        items: cubes,
        lastKey: result.lastKey,
      };
    }

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
    limit: number = 36,
  ): Promise<QueryResult> {
    const hashString = await this.hash({ type: 'oracle', value: oracleId });

    if (this.dualWriteEnabled) {
      const result = await CubeHashModel.query(hashString, ascending, lastKey, this.mapSortOrder(sortBy), limit);
      const cubeIds = result.items.map((item) => item.cube);
      const cubes = await this.batchGet(cubeIds);
      return {
        items: cubes,
        lastKey: result.lastKey,
      };
    }

    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries cubes that match ALL provided hash criteria (intersection).
   * Paginates through all results for each hash and returns cubes present in all result sets.
   *
   * @param hashes - Array of hash strings to query (max 10)
   * @param sortBy - How to sort the final results
   * @param ascending - Sort direction
   * @param cardCountFilter - Optional filter for card count { operator: 'eq' | 'gt' | 'lt', value: number }
   * @returns Cubes that match ALL hash criteria
   * @throws Error if dual write mode is enabled (old data model doesn't support this operation)
   */
  public async queryByMultipleHashes(
    hashes: string[],
    sortBy: SortOrder = 'popularity',
    ascending: boolean = false,
    cardCountFilter?: { operator: 'eq' | 'gt' | 'lt'; value: number },
  ): Promise<Cube[]> {
    if (hashes.length === 0) {
      return [];
    }

    if (hashes.length > 10) {
      throw new Error('Cannot query more than 10 hashes at once');
    }

    if (this.dualWriteEnabled) {
      throw new Error('queryByMultipleHashes is not supported in dual write mode');
    }

    // If card count filter is present, we must use GSI3 (cards) for the query
    // to leverage key condition on the sort key
    const querySortBy = cardCountFilter ? 'cards' : sortBy;

    // Query all hashes completely (paginate to end for each)
    const cubeIdSets = await Promise.all(
      hashes.map(async (hash) => {
        const cubeIds = new Set<string>();
        let lastKey: Record<string, any> | undefined = undefined;

        do {
          const result: QueryResult = cardCountFilter
            ? await this.queryByHashWithCardCountFilter(hash, cardCountFilter, lastKey)
            : await this.queryByHashWithSort(hash, querySortBy, ascending, lastKey, 100);

          result.items.forEach((cube: Cube) => cubeIds.add(cube.id));
          lastKey = result.lastKey;
        } while (lastKey);

        return cubeIds;
      }),
    );

    // Find intersection - cubes present in ALL sets
    if (cubeIdSets.length === 0 || !cubeIdSets[0]) {
      return [];
    }

    let intersectionIds: Set<string> = cubeIdSets[0];
    for (let i = 1; i < cubeIdSets.length; i++) {
      const currentSet = cubeIdSets[i];
      if (!currentSet) {
        continue;
      }

      const newIntersection = new Set<string>();
      for (const id of intersectionIds) {
        if (currentSet.has(id)) {
          newIntersection.add(id);
        }
      }
      intersectionIds = newIntersection;

      // Early exit if intersection is empty
      if (intersectionIds.size === 0) {
        return [];
      }
    }

    // Fetch cubes
    const cubes = await this.batchGet(Array.from(intersectionIds));

    // Sort results according to sortBy parameter (always in-memory when card count filter is used)
    return this.sortCubes(cubes, sortBy, ascending);
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
          const diff = a.date - b.date;
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
    limit: number = 36,
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
      // SK contains the cube partition key (CUBE#{id})
      const sk = item.SK as string;
      return sk.replace(`${this.itemType()}#`, '');
    });

    // Fetch cubes
    const cubes = await this.batchGet(cubeIds);

    return {
      items: cubes,
      lastKey: queryResult.LastEvaluatedKey,
    };
  }

  /**
   * Helper method to query by hash with card count filter using GSI3 key condition.
   * Uses DynamoDB key condition expressions for efficient filtering at the database level.
   */
  private async queryByHashWithCardCountFilter(
    hash: string,
    cardCountFilter: { operator: 'eq' | 'gt' | 'lt'; value: number },
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<QueryResult> {
    const paddedCardCount = `CARDS#${String(cardCountFilter.value).padStart(10, '0')}`;

    let keyConditionExpression: string;
    const expressionAttributeValues: Record<string, any> = {
      ':hash': hash,
    };

    switch (cardCountFilter.operator) {
      case 'eq':
        keyConditionExpression = 'GSI3PK = :hash AND GSI3SK = :cardCount';
        expressionAttributeValues[':cardCount'] = paddedCardCount;
        break;
      case 'gt':
        keyConditionExpression = 'GSI3PK = :hash AND GSI3SK > :cardCount';
        expressionAttributeValues[':cardCount'] = paddedCardCount;
        break;
      case 'lt':
        keyConditionExpression = 'GSI3PK = :hash AND GSI3SK < :cardCount';
        expressionAttributeValues[':cardCount'] = paddedCardCount;
        break;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: true, // Ascending by card count
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
      // SK contains the cube partition key (CUBE#{id})
      const sk = item.SK as string;
      return sk.replace(`${this.itemType()}#`, '');
    });

    // Fetch cubes
    const cubes = await this.batchGet(cubeIds);

    return {
      items: cubes,
      lastKey: queryResult.LastEvaluatedKey,
    };
  }

  /**
   * Maps our SortOrder to the old cubeHash model's sort order.
   */
  private mapSortOrder(sortBy: SortOrder): 'pop' | 'alpha' | 'cards' {
    switch (sortBy) {
      case 'popularity':
        return 'pop';
      case 'alphabetical':
        return 'alpha';
      case 'cards':
        return 'cards';
      default:
        return 'pop';
    }
  }
}
