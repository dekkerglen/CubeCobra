import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import { CardDetails } from '../../datatypes/Card';
import CardPackage, { CardPackageStatus, UnhydratedCardPackage } from '../../datatypes/CardPackage';
import UserType from '../../datatypes/User';
import createClient, { QueryInput } from '../util';

const User = require('./user');
const { cardFromId } = require('../../util/carddb');

const client = createClient({
  name: 'PACKAGE',
  partitionKey: 'id',
  indexes: [
    {
      name: 'ByVoteCount',
      partitionKey: 'status',
      sortKey: 'voteCount',
    },
    {
      name: 'ByDate',
      partitionKey: 'status',
      sortKey: 'date',
    },
    {
      name: 'ByOwner',
      partitionKey: 'owner',
      sortKey: 'date',
    },
  ],
  attributes: {
    id: 'S',
    status: 'S',
    voteCount: 'N',
    date: 'N',
    owner: 'S',
  },
});

//Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
const statusAttr: keyof UnhydratedCardPackage = 'status';
const ownerAttr: keyof UnhydratedCardPackage = 'owner';
const keywordsAttr: keyof UnhydratedCardPackage = 'keywords';

const createHydratedPackage = (
  document: UnhydratedCardPackage,
  owner: UserType, //TODO: User type
  cards: CardDetails[],
): CardPackage => {
  return {
    id: document.id!,
    title: document.title,
    date: document.date,
    owner,
    status: document.status,
    cards: cards,
    keywords: document.keywords,
    voters: document.voters,
    voteCount: document.voteCount,
  } as CardPackage;
};

const hydrate = async (pack?: UnhydratedCardPackage): Promise<CardPackage | undefined> => {
  if (!pack) {
    return pack;
  }

  const owner = await User.getById(pack.owner);
  const cards = pack.cards.map((c) => {
    // @ts-expect-error -- Temporary solution for cards accidently saved to dynamo instead of card ids
    if (typeof c !== 'string' && c.scryfall_id) {
      // @ts-expect-error -- Temporary solution
      return cardFromId(c.scryfall_id);
    } else {
      return cardFromId(c);
    }
  });

  return createHydratedPackage(pack, owner, cards);
};

const batchHydrate = async (packs: UnhydratedCardPackage[]): Promise<CardPackage[]> => {
  const owners: UserType[] = await User.batchGet(packs.map((pack) => pack.owner));

  return packs.map((pack) => {
    const owner = owners.find((owner) => owner.id === pack.owner);
    const cards = pack.cards.map((c) => {
      // @ts-expect-error -- Temporary solution for cards accidently saved to dynamo instead of card ids
      if (typeof c !== 'string' && c.scryfall_id) {
        // @ts-expect-error -- Temporary solution
        return cardFromId(c.scryfall_id);
      } else {
        return cardFromId(c);
      }
    });

    //Technically it is possible to not find an owner but let's assume our data is correct
    return createHydratedPackage(pack, owner!, cards);
  });
};

const applyKeywordFilter = (query: QueryInput, keywords: string): QueryInput => {
  if (!keywords) {
    return query;
  }

  const words = keywords?.toLowerCase()?.split(' ') || [];

  // all words must exist in the keywords
  query.FilterExpression = words.map((word) => `contains(#keywords, :${word})`).join(' and ');

  query.ExpressionAttributeNames = {
    ...query.ExpressionAttributeNames,
    '#keywords': keywordsAttr,
  };

  query.ExpressionAttributeValues = {
    ...query.ExpressionAttributeValues,
    ...words.reduce((acc: Record<string, string>, word) => {
      acc[`:${word}`] = word;
      return acc;
    }, {}),
  };

  return query;
};

type QueryResponse = { items?: CardPackage[]; lastKey?: DocumentClient.Key };

const packages = {
  getById: async (id: string): Promise<CardPackage | undefined> =>
    hydrate((await client.get(id)).Item as UnhydratedCardPackage),
  put: async (document: UnhydratedCardPackage | CardPackage): Promise<string> => {
    const id = document.id || uuidv4();

    let ownerId: string | undefined;
    if (document.owner && typeof document.owner !== 'string' && document.owner.id) {
      ownerId = document.owner.id;
    } else if (document.owner && typeof document.owner === 'string') {
      ownerId = document.owner;
    }

    let cardIds: string[] = [];
    if (document.cards) {
      cardIds = document.cards
        .map((card) => {
          if (typeof card !== 'string' && card.scryfall_id) {
            return card.scryfall_id;
          } else if (typeof card === 'string') {
            return card as string;
          } else {
            return undefined;
          }
        })
        .filter((cardId) => cardId !== undefined);
    }

    await client.put({
      id,
      title: document.title,
      date: document.date,
      owner: ownerId,
      status: document.status,
      cards: cardIds,
      voters: document.voters,
      keywords: document.keywords,
      voteCount: document.voters.length,
    });
    return id;
  },
  querySortedByDate: async (
    status: CardPackageStatus,
    keywords: string,
    ascending: boolean,
    lastKey?: DocumentClient.Key,
  ): Promise<QueryResponse> => {
    const query = {
      IndexName: 'ByDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': statusAttr,
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: 36,
    } as QueryInput;

    const result = await client.query(applyKeywordFilter(query, keywords));

    return {
      items: await batchHydrate(result.Items as UnhydratedCardPackage[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  querySortedByVoteCount: async (
    status: CardPackageStatus,
    keywords: string,
    ascending: boolean,
    lastKey?: DocumentClient.Key,
  ): Promise<QueryResponse> => {
    const query = {
      IndexName: 'ByVoteCount',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': statusAttr,
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: 36,
    } as QueryInput;

    const result = await client.query(applyKeywordFilter(query, keywords));

    return {
      items: await batchHydrate(result.Items as UnhydratedCardPackage[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryByOwner: async (owner: string, lastKey?: DocumentClient.Key): Promise<QueryResponse> => {
    const query = {
      IndexName: 'ByOwner',
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#owner': ownerAttr,
      },
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExclusiveStartKey: lastKey,
      Limit: 100, //Higher limit because this function is used to load all packages for a user into memory
    } as QueryInput;

    const result = await client.query(query);

    return {
      items: await batchHydrate(result.Items as UnhydratedCardPackage[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryByOwnerSortedByDate: async (
    owner: string,
    keywords: string,
    ascending: boolean,
    lastKey?: DocumentClient.Key,
  ): Promise<QueryResponse> => {
    //ByOwner secondary index is sorted by Date
    const query = {
      IndexName: 'ByOwner',
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#owner': ownerAttr,
      },
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: 36,
    };

    const result = await client.query(applyKeywordFilter(query, keywords));

    return {
      items: await batchHydrate(result.Items as UnhydratedCardPackage[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchPut: async (documents: UnhydratedCardPackage[]): Promise<void> => client.batchPut(documents),
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  scan: async (lastKey: DocumentClient.Key): Promise<QueryResponse> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });

    return {
      items: await batchHydrate(result.Items as UnhydratedCardPackage[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchDelete: async (keys: DocumentClient.Key[]): Promise<void> => {
    client.batchDelete(keys);
  },
  delete: async (id: string): Promise<void> => client.delete({ id }),
};

module.exports = packages;
export default packages;
