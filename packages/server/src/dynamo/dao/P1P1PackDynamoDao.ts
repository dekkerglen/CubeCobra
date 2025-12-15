/**
 * P1P1PackDynamoDao - Data Access Object for P1P1Pack entities in a single-table DynamoDB design.
 *
 * STORAGE STRATEGY:
 * - Pack metadata: Stored in DynamoDB with PK = P1P1PACK#{id}, SK = P1P1PACK
 * - Pack cards and extended data: Stored in S3 at p1p1-packs/{id}.json
 *
 * QUERY PATTERNS:
 * - getById(id): Get pack by ID
 * - queryByCube(cubeId, lastKey, limit): Get packs by cube with pagination
 * - addVote(packId, userId, cardIndex): Add or update user vote
 * - getVoteSummary(pack, currentUserId): Get voting summary with percentages
 *
 * DUAL WRITE MODE:
 * Supports gradual migration from old p1p1Pack model by writing to both systems
 * when dualWriteEnabled flag is set.
 */

import { DynamoDBDocumentClient, QueryCommandInput, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import Card from '@utils/datatypes/Card';
import {
  P1P1Pack,
  P1P1PackDynamoData,
  P1P1PackS3Data,
  P1P1VoteResult,
  P1P1VoteSummary,
} from '@utils/datatypes/P1P1Pack';
import { v4 as uuidv4 } from 'uuid';
import { cardFromId } from 'serverutils/carddb';

import { deleteObject, getBucketName, getObject, putObject } from '../s3client';
import p1p1PackModel from '../models/p1p1Pack';
import { BaseDynamoDao } from './BaseDynamoDao';

const S3_PREFIX = 'p1p1-packs/';

/**
 * Extended P1P1Pack type that includes required fields for DynamoDB storage.
 */
export interface P1P1PackExtended extends P1P1Pack {
  dateCreated: number;
  dateLastUpdated: number;
}

/**
 * Unhydrated P1P1Pack (just the DynamoDB metadata without S3 data).
 */
export interface UnhydratedP1P1Pack extends P1P1PackDynamoData {
  dateCreated: number;
  dateLastUpdated: number;
}

export class P1P1PackDynamoDao extends BaseDynamoDao<P1P1PackExtended, UnhydratedP1P1Pack> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'P1P1PACK';
  }

  /**
   * Gets the partition key for a pack.
   */
  protected partitionKey(item: P1P1PackExtended): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the pack.
   * GSI1: Query by cube and date
   */
  protected GSIKeys(item: P1P1PackExtended): {
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
      GSI1PK: item.cubeId ? `${this.itemType()}#CUBE#${item.cubeId}` : undefined,
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
   * Dehydrates a P1P1PackExtended to UnhydratedP1P1Pack for storage.
   */
  protected dehydrateItem(item: P1P1PackExtended): UnhydratedP1P1Pack {
    return {
      id: item.id,
      createdBy: item.createdBy,
      cubeId: item.cubeId,
      date: item.date,
      votesByUser: item.votesByUser || {},
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedP1P1Pack to P1P1PackExtended.
   */
  protected async hydrateItem(item: UnhydratedP1P1Pack): Promise<P1P1PackExtended> {
    // Get S3 data
    const s3Data = await this.getS3Data(item.id);

    if (!s3Data) {
      throw new Error(`S3 data not found for pack ${item.id}`);
    }

    // Add card details to cards
    const cardsWithDetails = this.addDetails(s3Data.cards);

    return {
      ...item,
      ...s3Data,
      cards: cardsWithDetails,
    };
  }

  /**
   * Hydrates multiple UnhydratedP1P1Packs to P1P1PackExtended (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedP1P1Pack[]): Promise<P1P1PackExtended[]> {
    if (items.length === 0) {
      return [];
    }

    // Batch get S3 data for all packs
    const s3DataPromises = items.map((item) => this.getS3Data(item.id));
    const s3DataArray = await Promise.all(s3DataPromises);

    return items.map((item, index) => {
      const s3Data = s3DataArray[index];

      if (!s3Data) {
        // Return a minimal pack if S3 data is missing
        console.error(`S3 data not found for pack ${item.id}`);
        return {
          ...item,
          botPick: undefined,
          botWeights: undefined,
          cards: [],
          createdByUsername: 'Unknown',
          seed: '',
        };
      }

      // Add card details to cards
      const cardsWithDetails = this.addDetails(s3Data.cards);

      return {
        ...item,
        ...s3Data,
        cards: cardsWithDetails,
      };
    });
  }

  /**
   * Gets a pack by ID.
   */
  public async getById(id: string): Promise<P1P1PackExtended | undefined> {
    if (this.dualWriteEnabled) {
      const pack = await p1p1PackModel.getById(id);
      if (!pack) return undefined;

      // Add dateCreated and dateLastUpdated if missing
      return {
        ...pack,
        dateCreated: pack.date,
        dateLastUpdated: pack.date,
      } as P1P1PackExtended;
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries packs by cube with pagination.
   */
  public async queryByCube(
    cubeId: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 20,
  ): Promise<{
    items: (Pick<P1P1PackDynamoData, 'id' | 'date' | 'createdBy'> & { createdByUsername: string })[];
    lastKey?: Record<string, NativeAttributeValue>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await p1p1PackModel.queryByCube(cubeId, lastKey, limit);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :cube',
      ProjectionExpression: 'PK, GSI1SK, #item.#id, #item.#date, #item.createdBy',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#id': 'id',
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':cube': `${this.itemType()}#CUBE#${cubeId}`,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    try {
      const result = await this.dynamoClient.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand(params));

      // Fetch createdByUsername from S3 for each pack
      const itemsWithUsername = await Promise.all(
        (result.Items || []).map(async (item: any) => {
          const s3Data = await this.getS3Data(item.item.id);
          return {
            id: item.item.id,
            date: item.item.date,
            createdBy: item.item.createdBy,
            createdByUsername: s3Data?.createdByUsername || 'Unknown',
          };
        }),
      );

      return {
        items: itemsWithUsername,
        lastKey: result.LastEvaluatedKey,
      };
    } catch (error) {
      console.error('Error querying packs by cube:', error);
      return {
        items: [],
        lastKey: undefined,
      };
    }
  }

  /**
   * Creates a new pack.
   */
  public async createPack(
    document: Omit<P1P1PackDynamoData, 'id' | 'date' | 'votesByUser'>,
    s3Data: P1P1PackS3Data,
  ): Promise<P1P1PackExtended> {
    const id = uuidv4();
    const now = Date.now();

    const pack: P1P1PackExtended = {
      ...document,
      id,
      date: now,
      votesByUser: {},
      dateCreated: now,
      dateLastUpdated: now,
      ...s3Data,
    };

    // Store extended data in S3 (without details)
    await this.putS3Data(id, {
      ...s3Data,
      cards: this.stripDetails(s3Data.cards),
    });

    // Store metadata in DynamoDB
    if (this.dualWriteEnabled) {
      await p1p1PackModel.put(document, s3Data);
    } else {
      await this.put(pack);
    }

    return pack;
  }

  /**
   * Overrides put to support dual writes and S3 storage.
   */
  public async put(item: P1P1PackExtended): Promise<void> {
    // Extract S3 data
    const s3Data: P1P1PackS3Data = {
      botPick: item.botPick,
      botWeights: item.botWeights,
      cards: this.stripDetails(item.cards),
      createdByUsername: item.createdByUsername,
      seed: item.seed,
    };

    // Store extended data in S3
    await this.putS3Data(item.id, s3Data);

    if (this.dualWriteEnabled) {
      // Extract DynamoDB-only fields for old model
      const dynamoData: Omit<P1P1PackDynamoData, 'id' | 'date' | 'votesByUser'> = {
        createdBy: item.createdBy,
        cubeId: item.cubeId,
      };

      await p1p1PackModel.put(dynamoData, {
        ...s3Data,
        cards: item.cards, // Old model expects cards with details
      });
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides update to support dual writes and S3 storage.
   */
  public async update(item: P1P1PackExtended): Promise<void> {
    // Update timestamp
    item.dateLastUpdated = Date.now();

    // Extract S3 data
    const s3Data: P1P1PackS3Data = {
      botPick: item.botPick,
      botWeights: item.botWeights,
      cards: this.stripDetails(item.cards),
      createdByUsername: item.createdByUsername,
      seed: item.seed,
    };

    // Store extended data in S3
    await this.putS3Data(item.id, s3Data);

    if (this.dualWriteEnabled) {
      // Check if item exists in new table first
      const existsInNewTable = await this.get({
        PK: this.partitionKey(item),
        SK: this.itemType(),
      });

      // If item doesn't exist in new table yet, use put instead of update
      if (existsInNewTable) {
        await super.update(item);
      } else {
        await super.put(item);
      }
    } else {
      await super.update(item);
    }
  }

  /**
   * Deletes a pack by ID.
   */
  public async deleteById(id: string): Promise<void> {
    if (this.dualWriteEnabled) {
      await p1p1PackModel.deleteById(id);
    }

    // Delete from S3
    try {
      const key = this.getS3Key(id);
      const bucket = getBucketName();
      await deleteObject(bucket, key);
    } catch (error) {
      console.error(`Failed to delete S3 object for pack ${id}:`, error);
    }

    // Delete from DynamoDB
    const pack = await this.getById(id);
    if (pack) {
      await this.delete(pack);
    }
  }

  /**
   * Adds a vote to a pack.
   */
  public async addVote(packId: string, userId: string, cardIndex: number): Promise<P1P1PackExtended | null> {
    if (this.dualWriteEnabled) {
      const pack = await p1p1PackModel.getById(packId);
      if (!pack) return null;

      const result = await p1p1PackModel.addVote(pack, userId, cardIndex);
      if (!result) return null;

      return {
        ...result,
        dateCreated: result.date,
        dateLastUpdated: Date.now(),
      } as P1P1PackExtended;
    }

    try {
      // Atomically set the user's vote (just store the card index)
      const result = await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: this.typedKey(packId),
            SK: this.itemType(),
          },
          UpdateExpression: 'SET #item.#voteMap.#userId = :cardIndex, #item.dateLastUpdated = :now',
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeNames: {
            '#item': 'item',
            '#voteMap': 'votesByUser',
            '#userId': userId,
          },
          ExpressionAttributeValues: {
            ':cardIndex': cardIndex,
            ':now': Date.now(),
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      if (result.Attributes) {
        const dynamoItem = result.Attributes as any;
        return await this.hydrateItem(dynamoItem.item);
      }
      return null;
    } catch (error) {
      console.error('Failed to add vote:', error);
      return null;
    }
  }

  /**
   * Gets vote summary for a pack.
   */
  public getVoteSummary(pack: P1P1PackExtended, currentUserId?: string): P1P1VoteSummary {
    if (this.dualWriteEnabled) {
      return p1p1PackModel.getVoteSummary(pack, currentUserId);
    }

    const votesByUser = pack.votesByUser || {};
    const totalVotes = Object.keys(votesByUser).length;

    // Count votes per card
    const voteCounts: { [cardIndex: number]: number } = {};
    let userVote: number | undefined;

    Object.entries(votesByUser).forEach(([userId, cardIndex]) => {
      const cardIdx = Number(cardIndex); // Ensure it's a number
      voteCounts[cardIdx] = (voteCounts[cardIdx] || 0) + 1;
      if (currentUserId && userId === currentUserId) {
        userVote = cardIdx;
      }
    });

    // Create results array based on number of cards in pack
    const cardCount = pack.cards.length;
    const results: P1P1VoteResult[] = Array.from({ length: cardCount }, (_, index) => ({
      cardIndex: index,
      voteCount: voteCounts[index] || 0,
      percentage: totalVotes > 0 ? ((voteCounts[index] || 0) / totalVotes) * 100 : 0,
    }));

    return {
      totalVotes,
      results,
      userVote,
      botPick: pack.botPick,
      botWeights: pack.botWeights,
    };
  }

  /**
   * Get S3 key for a P1P1 pack.
   */
  private getS3Key(packId: string): string {
    return `${S3_PREFIX}${packId}.json`;
  }

  /**
   * Store P1P1 pack data in S3.
   */
  private async putS3Data(packId: string, data: P1P1PackS3Data): Promise<void> {
    const key = this.getS3Key(packId);
    const bucket = getBucketName();
    await putObject(bucket, key, data);
  }

  /**
   * Retrieve P1P1 pack data from S3.
   */
  private async getS3Data(packId: string): Promise<P1P1PackS3Data | null> {
    try {
      const key = this.getS3Key(packId);
      const bucket = getBucketName();
      const result = (await getObject(bucket, key)) as P1P1PackS3Data;
      return result;
    } catch (error) {
      console.error('Failed to get S3 data for pack:', packId, error);
      return null;
    }
  }

  /**
   * Add card details to stripped cards.
   */
  private addDetails(cards: Card[]): Card[] {
    if (!cards) {
      return cards;
    }

    // if cards is string
    if (typeof cards === 'string') {
      try {
        cards = JSON.parse(cards);
      } catch {
        return [];
      }
    }

    cards.forEach((card) => {
      const cardDetails = cardFromId(card.cardID);
      if (cardDetails) {
        card.details = {
          ...cardDetails,
        };
      } else {
        // If cardDetails is null, skip adding details and let the image generation handle the error
        console.warn(`Missing card details for cardID: ${card.cardID}`);
      }
    });
    return cards;
  }

  /**
   * Strip card details for S3 storage.
   */
  private stripDetails(cards: Card[]): Card[] {
    const strippedCards = [...cards]; // Create copy to avoid mutating original
    strippedCards.forEach((card) => {
      delete card.details;
    });
    return strippedCards;
  }
}
