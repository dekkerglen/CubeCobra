import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import Card from '../../datatypes/Card';
import {
  P1P1Pack,
  P1P1PackDynamoData,
  P1P1PackS3Data,
  P1P1VoteResult,
  P1P1VoteSummary,
} from '../../datatypes/P1P1Pack.js';
import { cardFromId } from '../../util/carddb';
import { deleteObject, getBucketName, getObject, putObject } from '../s3client';
import createClient from '../util';

const client = createClient({
  name: 'P1P1_PACKS',
  partitionKey: 'id',
  indexes: [
    {
      name: 'ByCube',
      partitionKey: 'cubeId',
      sortKey: 'date',
    },
  ],
  attributes: {
    id: 'S',
    cubeId: 'S',
    date: 'N',
  },
});

const S3_PREFIX = 'p1p1-packs/';

/**
 * Get S3 key for a P1P1 pack
 */
const getS3Key = (packId: string): string => `${S3_PREFIX}${packId}.json`;

/**
 * Add card details to stripped cards
 */
const addDetails = (cards: Card[]): Card[] => {
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
};

/**
 * Strip card details for S3 storage
 */
const stripDetails = (cards: Card[]): Card[] => {
  const strippedCards = [...cards]; // Create copy to avoid mutating original
  strippedCards.forEach((card) => {
    delete card.details;
  });
  return strippedCards;
};

/**
 * Store P1P1 pack data in S3
 */
const putS3Data = async (packId: string, data: P1P1PackS3Data): Promise<void> => {
  const key = getS3Key(packId);
  const bucket = getBucketName();

  // Strip details before storing to S3
  const strippedData = {
    ...data,
    cards: stripDetails(data.cards),
  };
  await putObject(bucket, key, strippedData);
};

/**
 * Retrieve P1P1 pack data from S3
 */
const getS3Data = async (packId: string): Promise<P1P1PackS3Data | null> => {
  try {
    const key = getS3Key(packId);
    const bucket = getBucketName();
    const result = (await getObject(bucket, key)) as P1P1PackS3Data;
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get S3 data for pack:', packId, error);
    return null;
  }
};

/**
 * Hydrate DynamoDB item with S3 data
 */
const hydrate = async (item: P1P1PackDynamoData): Promise<P1P1Pack | null> => {
  const s3Data = await getS3Data(item.id!);
  if (!s3Data) {
    return null;
  }

  // Rehydrate cards with details
  const hydratedS3Data = {
    ...s3Data,
    cards: addDetails(s3Data.cards),
  };

  return {
    ...item,
    ...hydratedS3Data,
  } as P1P1Pack;
};

const p1p1Pack = {
  getById: async (id: string): Promise<P1P1Pack | null> => {
    const result = await client.get(id);

    if (!result.Item) {
      return null;
    }

    return await hydrate(result.Item as P1P1PackDynamoData);
  },

  queryByCube: async (
    cubeId: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit: number = 20,
  ): Promise<{
    items?: Pick<P1P1PackDynamoData, 'id' | 'date' | 'createdBy'>[];
    lastKey?: Record<string, NativeAttributeValue>;
  }> => {
    const result = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: 'cubeId = :cubeId',
      ExpressionAttributeValues: {
        ':cubeId': cubeId,
      },
      ProjectionExpression: 'id, #date, createdBy',
      ExpressionAttributeNames: {
        '#date': 'date', // 'date' is a reserved keyword
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });

    return {
      items: result.Items?.map((item) => ({
        id: item.id!,
        date: item.date!,
        createdBy: item.createdBy!,
      })),
      lastKey: result.LastEvaluatedKey,
    };
  },

  put: async (
    document: Omit<P1P1PackDynamoData, 'id' | 'date' | 'votesByUser'>,
    s3Data: P1P1PackS3Data,
  ): Promise<P1P1Pack> => {
    const id = uuidv4();
    const date = Date.now();

    const item: P1P1PackDynamoData = {
      ...document,
      id,
      date,
      votesByUser: {},
    };

    // Store main data in DynamoDB
    await client.put(item);

    // Store extended data in S3
    await putS3Data(id, s3Data);

    return {
      ...item,
      ...s3Data,
    };
  },

  deleteById: async (id: string): Promise<void> => {
    // Delete from DynamoDB
    await client.delete({ id });

    // Delete associated S3 object
    try {
      const key = getS3Key(id);
      const bucket = getBucketName();
      await deleteObject(bucket, key);
    } catch (error) {
      // Log error but don't fail the deletion - DynamoDB record is already gone
      // eslint-disable-next-line no-console
      console.error(`Failed to delete S3 object for pack ${id}:`, error);
    }
  },

  // Vote-related methods
  addVote: async (pack: P1P1Pack, userId: string, cardIndex: number): Promise<P1P1Pack | null> => {
    try {
      // Atomically set the user's vote (just store the card index)
      const result = await client.update({
        Key: { id: pack.id },
        UpdateExpression: 'SET #voteMap.#userId = :cardIndex',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: {
          '#voteMap': 'votesByUser',
          '#userId': userId,
        },
        ExpressionAttributeValues: {
          ':cardIndex': cardIndex,
        },
        ReturnValues: 'ALL_NEW',
      });

      if (result.Attributes) {
        return await hydrate(result.Attributes as P1P1PackDynamoData);
      }
      return null;
    } catch {
      // Failed to add vote
      return null;
    }
  },

  getVoteSummary: (pack: P1P1Pack, currentUserId?: string): P1P1VoteSummary => {
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
  },

  createTable: async () => client.createTable(),
};

module.exports = p1p1Pack;
export default p1p1Pack;
