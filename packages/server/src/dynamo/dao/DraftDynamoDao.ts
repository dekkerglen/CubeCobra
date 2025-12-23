/**
 * DraftDynamoDao - Data Access Object for Draft entities in a single-table DynamoDB design.
 *
 * STORAGE STRATEGY:
 * - Draft metadata: Stored in DynamoDB with PK = DRAFT#{id}, SK = DRAFT
 * - Draft cards: Stored in S3 at cardlist/{id}.json
 * - Draft seats: Stored in S3 at seats/{id}.json (includes seats, basics, InitialState)
 *
 * QUERY PATTERNS:
 * - getById(id): Get draft by ID
 * - batchGet(ids): Batch get drafts by IDs
 * - queryByOwner(owner, lastKey, limit): Get drafts by owner with pagination
 * - queryByCube(cubeId, lastKey): Get drafts by cube with pagination
 * - queryByCubeOwner(cubeOwner, lastKey): Get drafts by cube owner with pagination
 * - queryByTypeAndDate(type, lastKey): Get drafts by type with pagination
 *
 * DUAL WRITE MODE:
 * Supports gradual migration from old draft model by writing to both systems
 * when dualWriteEnabled flag is set.
 */

import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import DraftType, { DRAFT_TYPES, DraftmancerLog, REVERSE_TYPES } from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';
import { cardFromId } from 'serverutils/carddb';
import { v4 as uuidv4 } from 'uuid';

import { getObject, putObject } from '../s3client';
import { BaseDynamoDao } from './BaseDynamoDao';
import { CubeDynamoDao } from './CubeDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

/**
 * Extended Draft type that includes fields required for DynamoDB storage.
 * This extends the base Draft type with dateCreated, dateLastUpdated, and required owner.
 */
export interface Draft extends Omit<DraftType, 'owner' | 'date'> {
  owner: User;
  date: number;
  dateCreated: number;
  dateLastUpdated: number;
  seatNames?: string[];
}

export interface UnhydratedDraft {
  id: string;
  cube: string;
  owner: string; // User ID instead of User object
  cubeOwner: string; // User ID instead of User object
  date: number;
  dateCreated: number;
  dateLastUpdated: number;
  type: string;
  complete: boolean;
  name: string;
  seatNames?: string[];
  DraftmancerLog?: DraftmancerLog;
}

interface QueryResult {
  items: Draft[];
  lastKey?: Record<string, NativeAttributeValue>;
}

export class DraftDynamoDao extends BaseDynamoDao<Draft, UnhydratedDraft> {
  private readonly cubeDao: CubeDynamoDao;
  private readonly userDao: UserDynamoDao;

  constructor(dynamoClient: DynamoDBDocumentClient, cubeDao: CubeDynamoDao, userDao: UserDynamoDao, tableName: string) {
    super(dynamoClient, tableName);
    this.cubeDao = cubeDao;
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'DRAFT';
  }

  /**
   * Gets the partition key for a draft.
   */
  protected partitionKey(item: Draft): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the draft.
   * GSI1: Query by owner and date
   * GSI2: Query by cube and date
   * GSI3: Query by cube owner and date
   * GSI4: Query by type and date
   */
  protected GSIKeys(item: Draft): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;
    const cubeOwnerId = typeof item.cubeOwner === 'string' ? item.cubeOwner : item.cubeOwner?.id;

    return {
      GSI1PK: ownerId ? `${this.itemType()}#OWNER#${ownerId}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: item.cube ? `${this.itemType()}#CUBE#${item.cube}` : undefined,
      GSI2SK: item.date ? `DATE#${item.date}` : undefined,
      GSI3PK: cubeOwnerId ? `${this.itemType()}#CUBEOWNER#${cubeOwnerId}` : undefined,
      GSI3SK: item.date ? `DATE#${item.date}` : undefined,
      GSI4PK: item.type ? `${this.itemType()}#TYPE#${item.type}` : undefined,
      GSI4SK: item.date ? `DATE#${item.date}` : undefined,
    };
  }

  /**
   * Dehydrates a Draft to UnhydratedDraft for storage.
   */
  protected dehydrateItem(item: Draft): UnhydratedDraft {
    return {
      id: item.id,
      cube: item.cube,
      owner: typeof item.owner === 'string' ? item.owner : item.owner?.id,
      cubeOwner: typeof item.cubeOwner === 'string' ? item.cubeOwner : item.cubeOwner?.id,
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      type: item.type,
      complete: item.complete,
      name: item.name,
      seatNames: item.seatNames,
      DraftmancerLog: item.DraftmancerLog,
    };
  }

  /**
   * Hydrates a single UnhydratedDraft to Draft.
   */
  protected async hydrateItem(item: UnhydratedDraft): Promise<Draft> {
    const [owner, cubeOwner] = await Promise.all([
      this.userDao.getById(item.owner),
      this.userDao.getById(item.cubeOwner),
    ]);

    const defaultUser = {
      username: 'Anonymous',
      id: '404',
    } as User;

    // Get cards and seats from S3
    const [cards, seatsData] = await Promise.all([this.getCards(item.id), this.getSeats(item.id)]);

    // Add details to cards
    const cardsWithDetails = this.addDetails(cards);

    return {
      id: item.id,
      cube: item.cube,
      owner: owner || defaultUser,
      cubeOwner: cubeOwner || defaultUser,
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      type: item.type as 'g' | 'd' | 'u' | 's',
      complete: item.complete,
      name: item.name,
      seatNames: item.seatNames,
      cards: cardsWithDetails,
      seats: seatsData.seats || [],
      basics: seatsData.basics || [],
      InitialState: seatsData.InitialState || {},
      DraftmancerLog: item.DraftmancerLog,
    };
  }

  /**
   * Hydrates multiple UnhydratedDrafts to Drafts (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedDraft[]): Promise<Draft[]> {
    if (items.length === 0) {
      return [];
    }

    const defaultUser = {
      username: 'Anonymous',
      id: '404',
    } as User;

    // Collect all unique user IDs
    const userIds = new Set<string>();
    items.forEach((item) => {
      if (item.owner) userIds.add(item.owner);
      if (item.cubeOwner) userIds.add(item.cubeOwner);
    });

    // Batch get users
    const users = await this.userDao.batchGet(Array.from(userIds));

    // Batch get cards and seats for all drafts
    const cardsAndSeats = await Promise.all(
      items.map(async (item) => {
        const [cards, seatsData] = await Promise.all([this.getCards(item.id), this.getSeats(item.id)]);
        return {
          cards: this.addDetails(cards),
          seats: seatsData.seats || [],
          basics: seatsData.basics || [],
          InitialState: seatsData.InitialState || {},
        };
      }),
    );

    return items.map((item, index) => {
      const owner = users.find((u: User) => u.id === item.owner) || defaultUser;
      const cubeOwner = users.find((u: User) => u.id === item.cubeOwner) || defaultUser;
      const data = cardsAndSeats[index]!;

      return {
        id: item.id,
        cube: item.cube,
        owner,
        cubeOwner,
        date: item.date,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
        type: item.type as 'g' | 'd' | 'u' | 's',
        complete: item.complete,
        name: item.name,
        seatNames: item.seatNames,
        cards: data.cards,
        seats: data.seats,
        basics: data.basics,
        InitialState: data.InitialState,
        DraftmancerLog: item.DraftmancerLog,
      };
    });
  }

  /**
   * Gets a draft by ID.
   */
  public async getById(id: string): Promise<Draft | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Batch gets drafts by IDs.
   */
  public async batchGet(ids: string[]): Promise<Draft[]> {
    if (ids.length === 0) {
      return [];
    }

    // Get all drafts in parallel
    const drafts = await Promise.all(
      ids.map((id) =>
        this.get({
          PK: this.typedKey(id),
          SK: this.itemType(),
        }),
      ),
    );

    return drafts.filter((draft) => draft !== undefined) as Draft[];
  }

  /**
   * Queries drafts by owner with pagination (unhydrated version for listing).
   * Only hydrates user data, skips loading cards/seats from S3 for better performance.
   */
  public async queryByOwnerUnhydrated(
    owner: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 200,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :owner',
      FilterExpression: '#item.#complete = :complete',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#complete': 'complete',
      },
      ExpressionAttributeValues: {
        ':owner': `${this.itemType()}#OWNER#${owner}`,
        ':complete': true,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    // Query DynamoDB
    const data = await this.dynamoClient.send(new QueryCommand(params));
    const dynamoItems = (data.Items || []) as any[];
    const unhydratedItems = dynamoItems.map((item) => item.item as UnhydratedDraft);

    if (unhydratedItems.length === 0) {
      return {
        items: [],
        lastKey: data.LastEvaluatedKey,
      };
    }

    // Only hydrate user data, skip S3 reads for cards/seats
    const userIds = new Set<string>();
    unhydratedItems.forEach((item) => {
      if (item.owner) userIds.add(item.owner);
      if (item.cubeOwner) userIds.add(item.cubeOwner);
    });

    const users = await this.userDao.batchGet(Array.from(userIds));
    const defaultUser = { username: 'Anonymous', id: '404' } as User;

    const hydratedItems = unhydratedItems.map((item) => {
      const owner = users.find((u: User) => u.id === item.owner) || defaultUser;
      const cubeOwner = users.find((u: User) => u.id === item.cubeOwner) || defaultUser;

      return {
        id: item.id,
        cube: item.cube,
        owner,
        cubeOwner,
        date: item.date,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
        type: item.type as 'g' | 'd' | 'u' | 's',
        complete: item.complete,
        name: item.name,
        seatNames: item.seatNames,
        cards: [], // Empty array to satisfy type
        seats: [],
        basics: [],
        InitialState: [],
        DraftmancerLog: item.DraftmancerLog,
      };
    });

    return {
      items: hydratedItems,
      lastKey: data.LastEvaluatedKey,
    };
  }

  /**
   * Queries drafts by owner with pagination (full hydration with S3 reads).
   * Use queryByOwnerUnhydrated for listing/display purposes for better performance.
   */
  public async queryByOwner(
    owner: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 200,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :owner',
      FilterExpression: '#item.#complete = :complete',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#complete': 'complete',
      },
      ExpressionAttributeValues: {
        ':owner': `${this.itemType()}#OWNER#${owner}`,
        ':complete': true,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries drafts by cube with pagination (unhydrated version for listing).
   * Only hydrates user data, skips loading cards/seats from S3 for better performance.
   */
  public async queryByCubeUnhydrated(
    cubeId: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :cube',
      FilterExpression: '#item.#complete = :complete',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#complete': 'complete',
      },
      ExpressionAttributeValues: {
        ':cube': `${this.itemType()}#CUBE#${cubeId}`,
        ':complete': true,
      },
      ScanIndexForward: false,
      Limit: 200,
      ExclusiveStartKey: lastKey,
    };

    // Query DynamoDB
    const data = await this.dynamoClient.send(new QueryCommand(params));
    const dynamoItems = (data.Items || []) as any[];
    const unhydratedItems = dynamoItems.map((item) => item.item as UnhydratedDraft);

    if (unhydratedItems.length === 0) {
      return {
        items: [],
        lastKey: data.LastEvaluatedKey,
      };
    }

    // Only hydrate user data, skip S3 reads for cards/seats
    const userIds = new Set<string>();
    unhydratedItems.forEach((item) => {
      if (item.owner) userIds.add(item.owner);
      if (item.cubeOwner) userIds.add(item.cubeOwner);
    });

    const users = await this.userDao.batchGet(Array.from(userIds));
    const defaultUser = { username: 'Anonymous', id: '404' } as User;

    const hydratedItems = unhydratedItems.map((item) => {
      const owner = users.find((u: User) => u.id === item.owner) || defaultUser;
      const cubeOwner = users.find((u: User) => u.id === item.cubeOwner) || defaultUser;

      return {
        id: item.id,
        cube: item.cube,
        owner,
        cubeOwner,
        date: item.date,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
        type: item.type as 'g' | 'd' | 'u' | 's',
        complete: item.complete,
        name: item.name,
        seatNames: item.seatNames,
        cards: [], // Empty array to satisfy type
        seats: [],
        basics: [],
        InitialState: [],
        DraftmancerLog: item.DraftmancerLog,
      };
    });

    return {
      items: hydratedItems,
      lastKey: data.LastEvaluatedKey,
    };
  }

  /**
   * Queries drafts by cube with pagination (full hydration with S3 reads).
   * Use queryByCubeUnhydrated for listing/display purposes for better performance.
   */
  public async queryByCube(cubeId: string, lastKey?: Record<string, NativeAttributeValue>): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :cube',
      FilterExpression: '#item.#complete = :complete',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#complete': 'complete',
      },
      ExpressionAttributeValues: {
        ':cube': `${this.itemType()}#CUBE#${cubeId}`,
        ':complete': true,
      },
      ScanIndexForward: false,
      Limit: 200,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries drafts by cube owner with pagination (unhydrated version for listing).
   * Only hydrates user data, skips loading cards/seats from S3 for better performance.
   */
  public async queryByCubeOwnerUnhydrated(
    cubeOwner: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :cubeOwner',
      FilterExpression: '#item.#complete = :complete',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#complete': 'complete',
      },
      ExpressionAttributeValues: {
        ':cubeOwner': `${this.itemType()}#CUBEOWNER#${cubeOwner}`,
        ':complete': true,
      },
      ScanIndexForward: false,
      Limit: 200,
      ExclusiveStartKey: lastKey,
    };

    // Query DynamoDB
    const data = await this.dynamoClient.send(new QueryCommand(params));
    const dynamoItems = (data.Items || []) as any[];
    const unhydratedItems = dynamoItems.map((item) => item.item as UnhydratedDraft);

    if (unhydratedItems.length === 0) {
      return {
        items: [],
        lastKey: data.LastEvaluatedKey,
      };
    }

    // Only hydrate user data, skip S3 reads for cards/seats
    const userIds = new Set<string>();
    unhydratedItems.forEach((item) => {
      if (item.owner) userIds.add(item.owner);
      if (item.cubeOwner) userIds.add(item.cubeOwner);
    });

    const users = await this.userDao.batchGet(Array.from(userIds));
    const defaultUser = { username: 'Anonymous', id: '404' } as User;

    const hydratedItems = unhydratedItems.map((item) => {
      const owner = users.find((u: User) => u.id === item.owner) || defaultUser;
      const cubeOwner = users.find((u: User) => u.id === item.cubeOwner) || defaultUser;

      return {
        id: item.id,
        cube: item.cube,
        owner,
        cubeOwner,
        date: item.date,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
        type: item.type as 'g' | 'd' | 'u' | 's',
        complete: item.complete,
        name: item.name,
        seatNames: item.seatNames,
        cards: [], // Empty array to satisfy type
        seats: [],
        basics: [],
        InitialState: [],
        DraftmancerLog: item.DraftmancerLog,
      };
    });

    return {
      items: hydratedItems,
      lastKey: data.LastEvaluatedKey,
    };
  }

  /**
   * Queries drafts by cube owner with pagination (full hydration with S3 reads).
   * Use queryByCubeOwnerUnhydrated for listing/display purposes for better performance.
   */
  public async queryByCubeOwner(
    cubeOwner: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :cubeOwner',
      FilterExpression: '#item.#complete = :complete',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#complete': 'complete',
      },
      ExpressionAttributeValues: {
        ':cubeOwner': `${this.itemType()}#CUBEOWNER#${cubeOwner}`,
        ':complete': true,
      },
      ScanIndexForward: false,
      Limit: 200,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries drafts by type and date with pagination.
   */
  public async queryByTypeAndDate(
    type: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit?: number,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI4',
      KeyConditionExpression: 'GSI4PK = :type',
      ExpressionAttributeValues: {
        ':type': `${this.itemType()}#TYPE#${type}`,
      },
      ScanIndexForward: false,
      Limit: limit || 100,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries drafts by type within a specific date range.
   * This is more efficient than queryByTypeAndDate when you need drafts from a specific day.
   * @param type - Draft type ('g', 'd', 'u', 's')
   * @param startDate - Start date timestamp (inclusive)
   * @param endDate - End date timestamp (inclusive)
   * @param lastKey - Optional pagination key
   * @param limit - Maximum number of items to return
   */
  public async queryByTypeAndDateRange(
    type: string,
    startDate: number,
    endDate: number,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 1000,
  ): Promise<QueryResult> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI4',
      KeyConditionExpression: 'GSI4PK = :type AND GSI4SK BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':type': `${this.itemType()}#TYPE#${type}`,
        ':startDate': `DATE#${startDate}`,
        ':endDate': `DATE#${endDate}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries drafts by type within a specific date range without hydration (no S3 reads).
   * Returns only the metadata stored in DynamoDB - cards and seats are not loaded.
   * This is much more efficient when you only need basic draft information.
   * @param type - Draft type ('g', 'd', 'u', 's')
   * @param startDate - Start date timestamp (inclusive)
   * @param endDate - End date timestamp (inclusive)
   * @param lastKey - Optional pagination key
   * @param limit - Maximum number of items to return
   */
  public async queryByTypeAndDateRangeUnhydrated(
    type: string,
    startDate: number,
    endDate: number,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 1000,
  ): Promise<{
    items: UnhydratedDraft[];
    lastKey?: Record<string, NativeAttributeValue>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI4',
      KeyConditionExpression: 'GSI4PK = :type AND GSI4SK BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':type': `${this.itemType()}#TYPE#${type}`,
        ':startDate': `DATE#${startDate}`,
        ':endDate': `DATE#${endDate}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    // Query directly without hydration
    const data = await this.dynamoClient.send(new QueryCommand(params));
    const dynamoItems = (data.Items || []) as any[];
    const unhydratedItems = dynamoItems.map((item) => item.item as UnhydratedDraft);

    return {
      items: unhydratedItems,
      lastKey: data.LastEvaluatedKey,
    };
  }

  /**
   * Creates a new draft and returns its ID.
   * This method is compatible with the old draft model interface.
   *
   * @param draftData - Draft data (may or may not include an ID)
   * @returns The ID of the created draft
   */
  public async createDraft(draftData: {
    id?: string;
    seats: any[];
    cards: any[];
    cube: string;
    cubeOwner: string | User;
    owner?: string | User;
    type: 'g' | 'd' | 'u' | 's';
    complete: boolean;
    date?: number | Date;
    name?: string;
    basics?: number[];
    InitialState?: any;
    DraftmancerLog?: DraftmancerLog;
    seed?: string;
    seatNames?: string[];
  }): Promise<string> {
    const id = draftData.id || uuidv4();
    const now = Date.now();

    // Calculate seat names from mainboard colors
    const names = draftData.seats.map((seat: any) => this.assessColors(seat.mainboard, draftData.cards).join(''));

    // Get cube details
    const cube = await this.cubeDao.getById(draftData.cube);
    const cubeName = cube?.name || 'Unknown Cube';

    // Resolve cube owner
    let cubeOwner: User;
    if (typeof draftData.cubeOwner === 'string') {
      const owner = await this.userDao.getById(draftData.cubeOwner);
      cubeOwner = owner || ({ username: 'Anonymous', id: '404' } as User);
    } else {
      cubeOwner = draftData.cubeOwner;
    }

    // Resolve owner (may be undefined for anonymous drafts)
    let owner: User | undefined;
    if (draftData.owner) {
      if (typeof draftData.owner === 'string') {
        owner = (await this.userDao.getById(draftData.owner)) || undefined;
      } else {
        owner = draftData.owner;
      }
    }

    // Create draft object
    const draftDate = draftData.date
      ? typeof draftData.date === 'number'
        ? draftData.date
        : (draftData.date as any).valueOf()
      : now;

    const draft: Draft = {
      id,
      cube: draftData.cube,
      owner: owner || ({ username: 'Anonymous', id: '404' } as User),
      cubeOwner,
      date: draftDate,
      dateCreated: now,
      dateLastUpdated: now,
      type: draftData.type,
      complete: draftData.complete,
      name: `${names[0]} ${REVERSE_TYPES[draftData.type]} of ${cubeName}`,
      seatNames: names,
      cards: draftData.cards,
      seats: draftData.seats,
      basics: draftData.basics || [],
      InitialState: draftData.InitialState,
      DraftmancerLog: draftData.DraftmancerLog,
      seed: draftData.seed,
    };

    // Add seat names to each seat
    for (let i = 0; i < draft.seats.length; i++) {
      draft.seats[i]!.name = names[i];
    }

    // Save to S3
    await Promise.all([
      putObject(process.env.DATA_BUCKET!, `cardlist/${id}.json`, this.stripDetails(draft.cards)),
      putObject(process.env.DATA_BUCKET!, `seats/${id}.json`, {
        seats: draft.seats,
        basics: draft.basics,
        InitialState: draft.InitialState,
      }),
    ]);

    // Save metadata to DynamoDB
    await this.put(draft);

    return id;
  }

  /**
   * Creates or updates a draft.
   * @deprecated Use createDraft instead for new drafts
   */
  public async putDraft(draft: Draft): Promise<string> {
    return this.createDraft(draft);
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: Draft): Promise<void> {
    await super.put(item);
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: Draft): Promise<void> {
    // Update item's timestamp
    item.dateLastUpdated = Date.now();

    // Recalculate seat names from mainboard colors
    const names = item.seats.map((seat: any) => this.assessColors(seat.mainboard, item.cards).join(''));
    item.seatNames = names;

    // Update seat names within each seat
    for (let i = 0; i < item.seats.length; i++) {
      item.seats[i]!.name = names[i];
    }

    // Save cards and seats to S3 before updating metadata
    await Promise.all([
      putObject(process.env.DATA_BUCKET!, `cardlist/${item.id}.json`, this.stripDetails(item.cards)),
      putObject(process.env.DATA_BUCKET!, `seats/${item.id}.json`, {
        seats: item.seats,
        basics: item.basics,
        InitialState: item.InitialState,
      }),
    ]);

    await super.update(item);
  }

  /**
   * Deletes a draft.
   */
  public async deleteById(id: string): Promise<void> {
    const draft = await this.getById(id);
    if (draft) {
      await this.delete(draft);
    }
  }

  /**
   * Batch put drafts.
   */
  public async batchPutDrafts(drafts: Draft[]): Promise<void> {
    if (drafts.length === 0) {
      return;
    }

    // Filter out duplicates
    const filtered: Draft[] = [];
    const keys = new Set<string>();

    for (const draft of drafts) {
      if (!keys.has(draft.id)) {
        filtered.push(draft);
        keys.add(draft.id);
      }
    }

    // Save cards and seats to S3 for all drafts
    await Promise.all(
      filtered.map(async (draft) => {
        await Promise.all([
          putObject(process.env.DATA_BUCKET!, `cardlist/${draft.id}.json`, this.stripDetails(draft.cards)),
          putObject(process.env.DATA_BUCKET!, `seats/${draft.id}.json`, {
            seats: draft.seats,
            basics: draft.basics,
            InitialState: draft.InitialState,
          }),
        ]);
      }),
    );

    // Batch put metadata to DynamoDB
    await super.batchPut(filtered);
  }

  /**
   * Gets cards from S3.
   */
  private async getCards(id: string): Promise<any[]> {
    try {
      const cards = await getObject(process.env.DATA_BUCKET!, `cardlist/${id}.json`);
      return cards || [];
    } catch {
      return [];
    }
  }

  /**
   * Gets seats data from S3.
   */
  private async getSeats(id: string): Promise<{ seats: any[]; basics: number[]; InitialState: any }> {
    try {
      const data = await getObject(process.env.DATA_BUCKET!, `seats/${id}.json`);
      return data || { seats: [], basics: [], InitialState: {} };
    } catch {
      return { seats: [], basics: [], InitialState: {} };
    }
  }

  /**
   * Adds card details to cards for display.
   */
  private addDetails(cards: any[]): any[] {
    if (!cards) {
      return [];
    }

    // if cards is string, parse it
    if (typeof cards === 'string') {
      try {
        cards = JSON.parse(cards);
      } catch {
        return [];
      }
    }

    if (!cards) {
      return [];
    }

    return cards
      .filter((c: any) => c !== null)
      .map((card: any) => ({
        ...card,
        details: {
          ...cardFromId(card.cardID),
        },
      }));
  }

  /**
   * Strips card details before storage.
   */
  private stripDetails(cards: any[]): any[] {
    if (!cards || !Array.isArray(cards)) {
      return [];
    }
    return cards.map((card: any) => {
      const stripped = { ...card };
      delete stripped.details;
      return stripped;
    });
  }

  /**
   * Assesses the colors of a deck based on the mainboard cards.
   */
  private assessColors(mainboard: any, cards: any): string[] {
    const colors: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
    };

    let count = 0;
    for (const card of mainboard.flat(3)) {
      const details = cardFromId(cards[card].cardID);
      if (!details.type.includes('Land')) {
        count += 1;
        for (const color of details.color_identity) {
          if (colors[color] !== undefined) {
            colors[color] += 1;
          }
        }
      }
    }

    const threshold = 0.1;

    const colorKeysFiltered = Object.keys(colors).filter((color) => (colors[color] ?? 0) / count > threshold);

    if (colorKeysFiltered.length === 0) {
      return ['C'];
    }

    return colorKeysFiltered;
  }

  // Static type constants for external use
  static readonly TYPES = DRAFT_TYPES;
  static readonly REVERSE_TYPES = REVERSE_TYPES;
}
