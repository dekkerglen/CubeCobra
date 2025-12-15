import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { normalizeName } from '@utils/cardutil';
import CardPackage, { CardPackageStatus, UnhydratedCardPackage } from '@utils/datatypes/CardPackage';
import UserType from '@utils/datatypes/User';
import { cardFromId } from 'serverutils/carddb';
import { v4 as uuidv4 } from 'uuid';

import PackageModel from '../models/package';
import { BaseDynamoDao } from './BaseDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

export class PackageDynamoDao extends BaseDynamoDao<CardPackage, UnhydratedCardPackage> {
  private readonly dualWriteEnabled: boolean;
  private readonly userDao: UserDynamoDao;

  constructor(
    dynamoClient: DynamoDBDocumentClient,
    userDao: UserDynamoDao,
    tableName: string,
    dualWriteEnabled: boolean = false,
  ) {
    super(dynamoClient, tableName);
    this.userDao = userDao;
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'PACKAGE';
  }

  /**
   * Gets the partition key for a package.
   */
  protected partitionKey(item: CardPackage): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the package.
   * GSI1: Query by status with date sorting
   * GSI2: Query by status with vote count sorting
   * GSI3: Query by owner with date sorting
   */
  protected GSIKeys(item: CardPackage): {
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

    return {
      GSI1PK: item.status ? `${this.itemType()}#STATUS#${item.status}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: item.status ? `${this.itemType()}#STATUS#${item.status}` : undefined,
      GSI2SK: item.voteCount !== undefined ? `VOTECOUNT#${String(item.voteCount).padStart(10, '0')}` : undefined,
      GSI3PK: ownerId ? `${this.itemType()}#OWNER#${ownerId}` : undefined,
      GSI3SK: item.date ? `DATE#${item.date}` : undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a CardPackage to UnhydratedCardPackage for storage.
   */
  protected dehydrateItem(item: CardPackage): UnhydratedCardPackage {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    const cardIds = item.cards
      .map((card) => {
        if (typeof card !== 'string' && card.scryfall_id) {
          return card.scryfall_id;
        } else if (typeof card === 'string') {
          return card;
        }
        return undefined;
      })
      .filter((cardId) => cardId !== undefined) as string[];

    return {
      id: item.id,
      title: item.title,
      date: item.date,
      owner: ownerId!,
      status: item.status,
      cards: cardIds,
      keywords: item.keywords,
      voters: item.voters,
      voteCount: item.voteCount,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedCardPackage to CardPackage.
   */
  protected async hydrateItem(item: UnhydratedCardPackage): Promise<CardPackage> {
    const owner = await this.userDao.getById(item.owner);

    const cards = item.cards.map((c) => {
      // @ts-expect-error -- Temporary solution for cards accidentally saved to dynamo instead of card ids
      if (typeof c !== 'string' && c.scryfall_id) {
        // @ts-expect-error -- Temporary solution
        return cardFromId(c.scryfall_id);
      } else {
        return cardFromId(c);
      }
    });

    return {
      id: item.id!,
      title: item.title,
      date: item.date,
      owner: owner!,
      status: item.status,
      cards,
      keywords: item.keywords,
      voters: item.voters,
      voteCount: item.voteCount,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates multiple UnhydratedCardPackages to CardPackages (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedCardPackage[]): Promise<CardPackage[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.map((item) => item.owner).filter(Boolean) as string[];
    const owners = ownerIds.length > 0 ? await this.userDao.batchGet(ownerIds) : [];

    return items.map((item) => {
      const owner = owners.find((o: UserType) => o.id === item.owner);

      const cards = item.cards.map((c) => {
        // @ts-expect-error -- Temporary solution for cards accidentally saved to dynamo instead of card ids
        if (typeof c !== 'string' && c.scryfall_id) {
          // @ts-expect-error -- Temporary solution
          return cardFromId(c.scryfall_id);
        } else {
          return cardFromId(c);
        }
      });

      return {
        id: item.id!,
        title: item.title,
        date: item.date,
        owner: owner!,
        status: item.status,
        cards,
        keywords: item.keywords,
        voters: item.voters,
        voteCount: item.voteCount,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
      };
    });
  }

  /**
   * Applies keyword filter to query parameters.
   */
  private applyKeywordFilter(params: QueryCommandInput, keywords: string): QueryCommandInput {
    if (!keywords) {
      return params;
    }

    const words = (keywords?.toLowerCase()?.split(' ') || []).map(normalizeName).map(
      // remove any non-alphanumeric characters
      (word) => word.replace(/[^a-z0-9]/g, ''),
    );

    // all words must exist in the keywords
    params.FilterExpression = words.map((word) => `contains(#keywords, :${word})`).join(' and ');

    params.ExpressionAttributeNames = {
      ...params.ExpressionAttributeNames,
      '#keywords': 'item.keywords',
    };

    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ...words.reduce((acc: Record<string, string>, word) => {
        acc[`:${word}`] = word;
        return acc;
      }, {}),
    };

    return params;
  }

  /**
   * Gets a package by ID.
   */
  public async getById(id: string): Promise<CardPackage | undefined> {
    if (this.dualWriteEnabled) {
      return PackageModel.getById(id);
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries packages by status, ordered by date, with pagination.
   */
  public async querySortedByDate(
    status: CardPackageStatus,
    keywords: string,
    ascending: boolean,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await PackageModel.querySortedByDate(status, keywords, ascending, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    let params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#STATUS#${status}`,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    params = this.applyKeywordFilter(params, keywords);

    return this.query(params);
  }

  /**
   * Queries packages by status, ordered by vote count, with pagination.
   */
  public async querySortedByVoteCount(
    status: CardPackageStatus,
    keywords: string,
    ascending: boolean,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await PackageModel.querySortedByVoteCount(status, keywords, ascending, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    let params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#STATUS#${status}`,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    params = this.applyKeywordFilter(params, keywords);

    return this.query(params);
  }

  /**
   * Queries packages by owner, ordered by date, with pagination.
   */
  public async queryByOwner(
    owner: string,
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await PackageModel.queryByOwner(owner, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#OWNER#${owner}`,
      },
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    return this.query(params);
  }

  /**
   * Queries packages by owner, ordered by date, with keyword filtering and pagination.
   */
  public async queryByOwnerSortedByDate(
    owner: string,
    keywords: string,
    ascending: boolean,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await PackageModel.queryByOwnerSortedByDate(owner, keywords, ascending, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    let params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#OWNER#${owner}`,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    params = this.applyKeywordFilter(params, keywords);

    return this.query(params);
  }

  /**
   * Creates a new package with generated ID and proper defaults.
   */
  public async createPackage(
    partial: Omit<UnhydratedCardPackage, 'id' | 'voteCount' | 'dateCreated' | 'dateLastUpdated'>,
  ): Promise<string> {
    const id = uuidv4();
    const now = Date.now();

    const unhydratedPackage: UnhydratedCardPackage = {
      ...partial,
      id,
      voteCount: partial.voters.length,
      dateCreated: now,
      dateLastUpdated: now,
    };

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await PackageModel.put(unhydratedPackage);
    }

    // Hydrate and write to new table
    const hydratedPackage = await this.hydrateItem(unhydratedPackage);
    await super.put(hydratedPackage);

    return id;
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: CardPackage): Promise<void> {
    // Ensure voteCount is in sync with voters length
    const itemWithVoteCount = {
      ...item,
      voteCount: item.voters.length,
    };

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([PackageModel.put(this.dehydrateItem(itemWithVoteCount)), super.put(itemWithVoteCount)]);
    } else {
      await super.put(itemWithVoteCount);
    }
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: CardPackage): Promise<void> {
    // Ensure voteCount is in sync with voters length
    const itemWithVoteCount = {
      ...item,
      voteCount: item.voters.length,
    };

    if (this.dualWriteEnabled) {
      // Check if item exists in new table first
      const existsInNewTable = await this.get({
        PK: this.partitionKey(itemWithVoteCount),
        SK: this.itemType(),
      });

      // Write to both old and new paths
      // If item doesn't exist in new table yet, use put instead of update
      await Promise.all([
        PackageModel.put(this.dehydrateItem(itemWithVoteCount)),
        existsInNewTable ? super.update(itemWithVoteCount) : super.put(itemWithVoteCount),
      ]);
    } else {
      await super.update(itemWithVoteCount);
    }
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: CardPackage): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      await Promise.all([PackageModel.delete(item.id), super.delete(item)]);
    } else {
      await super.delete(item);
    }
  }

  /**
   * Batch put packages.
   */
  public async batchPut(items: CardPackage[]): Promise<void> {
    // Ensure voteCount is in sync with voters length for all items
    const itemsWithVoteCount = items.map((item) => ({
      ...item,
      voteCount: item.voters.length,
    }));

    if (this.dualWriteEnabled) {
      await Promise.all([
        PackageModel.batchPut(itemsWithVoteCount.map((item) => this.dehydrateItem(item))),
        super.batchPut(itemsWithVoteCount),
      ]);
    } else {
      await super.batchPut(itemsWithVoteCount);
    }
  }
}
