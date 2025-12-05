import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { CubeCards } from '@utils/datatypes/Cube';
import createClient from 'dynamo/util';
import { cardFromId } from 'serverutils/carddb';

interface CubeMetadata {
  id: string;
  shortId?: string;
  featured: boolean;
  categoryOverride?: string;
  categoryPrefixes?: string[];
  tags?: string[];
  name: string;
  following: string[];
  cardCount: number;
}

interface CubeHashRow {
  hash: string;
  cube: string;
  numFollowers: number;
  name: string;
  cardCount: number;
}

interface QueryResult {
  items: CubeHashRow[];
  lastKey?: Record<string, NativeAttributeValue>;
}

type SortOrder = 'pop' | 'alpha' | 'cards';

const FIELDS = {
  HASH: 'hash',
  CUBE_ID: 'cube',
  NUM_FOLLOWERS: 'numFollowers',
  NAME: 'name',
  CARD_COUNT: 'cardCount',
} as const;

const client = createClient({
  name: 'CUBE_HASHES',
  partitionKey: FIELDS.CUBE_ID,
  sortKey: FIELDS.HASH,
  attributes: {
    [FIELDS.HASH]: 'S',
    [FIELDS.NUM_FOLLOWERS]: 'N',
    [FIELDS.CARD_COUNT]: 'N',
    [FIELDS.NAME]: 'S',
    [FIELDS.CUBE_ID]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.NUM_FOLLOWERS,
      name: 'SortedByFollowers',
    },
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.NAME,
      name: 'SortedByName',
    },
    {
      partitionKey: FIELDS.HASH,
      sortKey: FIELDS.CARD_COUNT,
      name: 'SortedByCardCount',
    },
  ],
});

const getShortIdHash = (shortId: string): string => {
  //Case sensitive!
  return `shortid:${shortId}`;
};

const hashShortId = (metadata: CubeMetadata): string[] => {
  if (!metadata.shortId || metadata.shortId.length === 0) {
    return [];
  }
  return [getShortIdHash(metadata.shortId)];
};

const hashFeatured = (metadata: CubeMetadata): string[] => {
  return [`featured:${metadata.featured}`];
};

const hashCategories = (metadata: CubeMetadata): string[] => {
  if (!metadata.categoryOverride) {
    return [];
  }

  const res: string[] = [];

  res.push(`category:${metadata.categoryOverride}`);

  for (const prefix of metadata.categoryPrefixes || []) {
    res.push(`category:${prefix.toLowerCase()}`);
  }

  return res;
};

const hashTags = (metadata: CubeMetadata): string[] => {
  return (metadata.tags || []).map((tag: string) => `tag:${tag.toLowerCase()}`);
};

const hashKeywords = (metadata: CubeMetadata): string[] => {
  const res: string[] = [];

  const namewords = metadata.name
    .replace(/[^\w\s]/gi, '')
    .toLowerCase()
    .split(' ')
    .filter((keyword: string) => keyword.length > 0);

  for (let i = 0; i < namewords.length; i++) {
    for (let j = i + 1; j < namewords.length + 1; j++) {
      const slice = namewords.slice(i, j);
      res.push(`keywords:${slice.join(' ')}`);
    }
  }

  return res;
};

const hashOracles = (cards: CubeCards): string[] => {
  const res: string[] = [];

  for (const card of cards.mainboard) {
    const oracle = cardFromId(card.cardID).oracle_id;

    if (oracle) {
      res.push(`oracle:${cardFromId(card.cardID).oracle_id}`);
    }
  }

  return res;
};

const getHashesForMetadata = (metadata: CubeMetadata): string[] => {
  return [
    ...new Set([
      ...hashShortId(metadata),
      ...hashFeatured(metadata),
      ...hashCategories(metadata),
      ...hashTags(metadata),
      ...hashKeywords(metadata),
    ]),
  ];
};
const getHashesForCards = (cards: CubeCards): string[] => {
  return [...new Set([...hashOracles(cards)])];
};

const getHashesForCube = (metadata: CubeMetadata, cards: CubeCards): string[] => {
  return [...new Set([...getHashesForCards(cards), ...getHashesForMetadata(metadata)])];
};

const getSortedByFollowers = async (
  hash: string,
  ascending: boolean = true,
  lastKey?: Record<string, NativeAttributeValue>,
  limit: number = 36,
): Promise<QueryResult> => {
  const result = await client.query({
    IndexName: 'SortedByFollowers',
    KeyConditionExpression: `#p1 = :hash`,
    ExpressionAttributeValues: {
      ':hash': hash,
    },
    ExpressionAttributeNames: {
      '#p1': FIELDS.HASH,
    },
    ExclusiveStartKey: lastKey,
    ScanIndexForward: ascending,
    Limit: limit,
  });
  return {
    items: result.Items as CubeHashRow[],
    lastKey: result.LastEvaluatedKey,
  };
};

const getSortedByName = async (
  hash: string,
  ascending: boolean = true,
  lastKey?: Record<string, NativeAttributeValue>,
  limit: number = 36,
): Promise<QueryResult> => {
  const result = await client.query({
    IndexName: 'SortedByName',
    KeyConditionExpression: `#p1 = :hash`,
    ExpressionAttributeValues: {
      ':hash': hash,
    },
    ExpressionAttributeNames: {
      '#p1': FIELDS.HASH,
    },
    ExclusiveStartKey: lastKey,
    ScanIndexForward: ascending,
    Limit: limit,
  });
  return {
    items: result.Items as CubeHashRow[],
    lastKey: result.LastEvaluatedKey,
  };
};

const getSortedByCardCount = async (
  hash: string,
  ascending: boolean = true,
  lastKey?: Record<string, NativeAttributeValue>,
  limit: number = 36,
): Promise<QueryResult> => {
  const result = await client.query({
    IndexName: 'SortedByCardCount',
    KeyConditionExpression: `#p1 = :hash`,
    ExpressionAttributeValues: {
      ':hash': hash,
    },
    ExpressionAttributeNames: {
      '#p1': FIELDS.HASH,
    },
    ExclusiveStartKey: lastKey,
    ScanIndexForward: ascending,
    Limit: limit,
  });
  return {
    items: result.Items as CubeHashRow[],
    lastKey: result.LastEvaluatedKey,
  };
};

const cubeHash = {
  query: async (
    hash: string,
    ascending: boolean = true,
    lastKey: Record<string, NativeAttributeValue> | undefined = undefined,
    order: SortOrder = 'pop',
    limit: number = 36,
  ): Promise<QueryResult> => {
    switch (order) {
      case 'pop':
        return getSortedByFollowers(hash, ascending, lastKey, limit);
      case 'alpha':
        return getSortedByName(hash, ascending, lastKey, limit);
      case 'cards':
        return getSortedByCardCount(hash, ascending, lastKey, limit);
      default:
        return getSortedByFollowers(hash, ascending, lastKey, limit);
    }
  },
  getHashesByCubeId: async (cubeId: string): Promise<CubeHashRow[]> => {
    const items: CubeHashRow[] = [];
    let lastKey: Record<string, NativeAttributeValue> | undefined = undefined;

    do {
      const result = await client.query({
        KeyConditionExpression: `#p1 = :cubeId`,
        ExpressionAttributeValues: {
          ':cubeId': cubeId,
        },
        ExpressionAttributeNames: {
          '#p1': FIELDS.CUBE_ID,
        },
        ExclusiveStartKey: lastKey,
      });
      items.push(...(result.Items as CubeHashRow[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  },
  getSortedByCardCount,
  getSortedByName,
  getSortedByFollowers,
  batchPut: async (documents: CubeHashRow[]): Promise<void> => client.batchPut(documents),
  batchDelete: async (keys: Array<{ hash: string; cube: string }>): Promise<void> => client.batchDelete(keys),
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  getHashRowsForMetadata: (metadata: CubeMetadata): CubeHashRow[] => {
    const hashes = getHashesForMetadata(metadata);

    return hashes.map((hash) => ({
      [FIELDS.HASH]: hash,
      [FIELDS.NUM_FOLLOWERS]: metadata.following.length,
      [FIELDS.CARD_COUNT]: metadata.cardCount,
      [FIELDS.NAME]: metadata.name,
      [FIELDS.CUBE_ID]: metadata.id,
    }));
  },
  getHashRowsForCube: (metadata: CubeMetadata, cards: CubeCards): CubeHashRow[] => {
    const hashes = getHashesForCube(metadata, cards);

    return hashes.map((hash) => ({
      [FIELDS.HASH]: hash,
      [FIELDS.NUM_FOLLOWERS]: metadata.following.length,
      [FIELDS.CARD_COUNT]: metadata.cardCount,
      [FIELDS.NAME]: metadata.name,
      [FIELDS.CUBE_ID]: metadata.id,
    }));
  },
  getShortIdHash,
  FIELDS,
};

module.exports = cubeHash;
export default cubeHash;
