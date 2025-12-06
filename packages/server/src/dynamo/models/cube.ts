import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import CubeType from '@utils/datatypes/Cube';
import { normalizeDraftFormatSteps } from '@utils/draftutil';
import _ from 'lodash';

import { cardFromId, getPlaceholderCard } from 'serverutils/carddb';
import cloudwatch from 'serverutils/cloudwatch';
import { getImageData } from 'serverutils/imageutil';
import { deleteObject, getObject, putObject } from '../s3client';
import createClient from '../util';
import cubeHash from './cubeHash';
import User from './user';

interface QueryResult {
  items: CubeType[];
  lastKey?: Record<string, NativeAttributeValue>;
}

const DEFAULT_BASICS = [
  '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
  '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
  '19e71532-3f79-4fec-974f-b0e85c7fe701',
  '8365ab45-6d78-47ad-a6ed-282069b0fabc',
  '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
];

const CARD_LIMIT = 10000;
const MILLISECONDS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

const FIELDS = {
  ID: 'id',
  SHORT_ID: 'shortId',
  OWNER: 'owner',
  NAME: 'name',
  VISIBILITY: 'visibility',
  PRICE_VISIBILITY: 'priceVisibility',
  FEATURED: 'featured',
  CATEGORY_OVERRIDE: 'categoryOverride',
  CATEGORY_PREFIXES: 'categoryPrefixes',
  TAG_COLORS: 'tagColors',
  DEFAULT_DRAFT_FORMAT: 'defaultFormat',
  NUM_DECKS: 'numDecks',
  DESCRIPTION: 'description',
  IMAGE_NAME: 'imageName',
  DATE: 'date',
  DEFAULT_SORTS: 'defaultSorts',
  SHOW_UNSORTED: 'showUnsorted',
  COLLAPSE_DUPLICATE_CARDS: 'collapseDuplicateCards',
  DRAFT_FORMATS: 'formats',
  USERS_FOLLOWING: 'following',
  DEFAULT_STATUS: 'defaultStatus',
  DEFAULT_PRINTING: 'defaultPrinting',
  DISABLE_NOTIFICATIONS: 'disableAlerts',
  BASICS: 'basics',
  TAGS: 'tags',
  KEYWORDS: 'keywords',
  CARD_COUNT: 'cardCount',
  VERSION: 'version',
} as const;

const VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
  UNLISTED: 'un',
} as const;

const PRICE_VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
} as const;

const getVisibility = (isListed: boolean, isPrivate: boolean): string => {
  if (isPrivate) {
    return VISIBILITY.PRIVATE;
  }
  if (!isListed) {
    return VISIBILITY.UNLISTED;
  }
  return VISIBILITY.PUBLIC;
};

const client = createClient({
  name: 'CUBE_METADATA',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.OWNER]: 'S',
    [FIELDS.VISIBILITY]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
      name: 'ByOwner',
    },
    {
      partitionKey: FIELDS.VISIBILITY,
      sortKey: FIELDS.DATE,
      name: 'ByVisiblity',
    },
  ],
});

const addDetails = (cards: any[]): void => {
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
};

const stripDetails = (cards: any[]): void => {
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
};

const getCards = async (id: string): Promise<any> => {
  try {
    const cards = await getObject(process.env.DATA_BUCKET!, `cube/${id}.json`);

    const totalCardCount = cards.mainboard.length + cards.maybeboard.length;

    if (totalCardCount > CARD_LIMIT) {
      throw new Error(`Cannot load cube: ${id} - too many cards: ${totalCardCount}`);
    }

    for (const [board, list] of Object.entries(cards)) {
      if (board !== 'id') {
        addDetails(list as any[]);
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
};

const hydrate = async (cube: any): Promise<CubeType | undefined> => {
  if (!cube) {
    return cube;
  }

  cube.owner = await User.getById(cube.owner);
  cube.image = getImageData(cube.imageName);

  const draftFormats = cube?.formats || [];
  //Correct bad custom draft formats on load, so any page using them are using good versions
  for (let format of draftFormats) {
    format = normalizeDraftFormatSteps(format);
  }

  return cube;
};

const batchHydrate = async (cubes: any[]): Promise<CubeType[]> => {
  const owners = await User.batchGet(cubes.map((cube: any) => cube.owner).filter((owner: any) => owner));

  return cubes.map((cube: any) => {
    cube.owner = owners.find((owner) => owner.id === cube.owner);
    cube.image = getImageData(cube.imageName);

    const draftFormats = cube?.formats || [];
    //Correct bad custom draft formats on load, so any page using them are using good versions
    for (let format of draftFormats) {
      format = normalizeDraftFormatSteps(format);
    }

    return cube;
  });
};

const numNull = (arr: any[]): number => {
  const serialized = JSON.stringify(arr);
  const parsed = JSON.parse(serialized);

  return parsed.filter((card: any) => card === null).length;
};

const exportData = {
  getCards,
  updateCards: async (id: string, newCards: any): Promise<void> => {
    const nullCards = numNull(newCards.mainboard) + numNull(newCards.maybeboard);

    if (nullCards > 0) {
      throw new Error(`Cannot save cube: ${nullCards} null cards`);
    }

    const oldMetadata = (await client.get(id)).Item;
    const newMetadata = JSON.parse(JSON.stringify(oldMetadata));

    const main = newCards.mainboard;
    newMetadata.cardCount = main.length;
    newMetadata.version = (newMetadata.version || 0) + 1;

    const totalCards = main.length + newCards.maybeboard.length;

    if (totalCards > CARD_LIMIT) {
      throw new Error(`Cannot save cube: too many cards (${totalCards}/${CARD_LIMIT})`);
    }

    // strip details from cards
    for (const [board, list] of Object.entries(newCards)) {
      if (board !== 'id') {
        stripDetails(list as any[]);
      }
    }

    newMetadata.date = new Date().valueOf();
    await client.put(newMetadata);
    await putObject(process.env.DATA_BUCKET!, `cube/${id}.json`, newCards);
  },
  deleteById: async (id: string): Promise<void> => {
    const document = (await client.get(id)).Item;
    const hashes = cubeHash.getHashRowsForMetadata(document as any);
    await cubeHash.batchDelete(hashes.map((hashRow: any) => ({ hash: hashRow.hash, cube: id })));
    await client.delete({ id });
    await deleteObject(process.env.DATA_BUCKET!, `cube/${id}.json`);
  },
  getById: async (id: string): Promise<CubeType | null | undefined> => {
    const byId = await client.get(id);
    if (byId.Item) {
      return hydrate(byId.Item);
    }

    const byShortId = await cubeHash.getSortedByName(cubeHash.getShortIdHash(id));
    if (byShortId.items && byShortId.items.length > 0) {
      const cubeId = byShortId.items[0]!.cube;
      const query = await client.get(cubeId);
      return hydrate(query.Item);
    }

    return null;
  },
  batchGet: async (ids: string[]): Promise<CubeType[]> =>
    (await batchHydrate((await client.batchGet(ids)) || [])).filter((cube: any) => cube),
  batchGetUnhydrated: async (ids: string[]): Promise<any[]> => client.batchGet(ids),
  getByOwner: async (owner: string, lastKey?: Record<string, NativeAttributeValue>): Promise<QueryResult> => {
    const result = await client.query({
      IndexName: 'ByOwner',
      KeyConditionExpression: `#p1 = :owner`,
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.OWNER,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: 100,
    });
    return {
      items: await batchHydrate(result.Items || []),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByVisibility: async (
    visibility: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit = 36,
  ): Promise<QueryResult> => {
    const result = await client.query({
      IndexName: 'ByVisiblity',
      KeyConditionExpression: `#p1 = :visibility`,
      ExpressionAttributeValues: {
        ':visibility': visibility,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.VISIBILITY,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit,
    });
    return {
      items: await batchHydrate(result.Items || []),
      lastKey: result.LastEvaluatedKey,
    };
  },
  scan: async (
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items: any[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });
    // this is only used for fixing hashes, so we don't need to hydrate
    return {
      items: result.Items || [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document: any): Promise<void> => {
    const oldDocument = (await client.get(document.id)).Item;

    if (_.isEqual(oldDocument, document)) {
      return;
    }

    if (!document[FIELDS.ID]) {
      throw new Error('Invalid document: No partition key provided');
    }

    const oldHashes = cubeHash.getHashRowsForMetadata(oldDocument! as any);
    const newHashes = cubeHash.getHashRowsForMetadata(document as any);

    // getObject hashes to delete with deep object equality
    // delete old hash row if no new hash row has this hash
    const hashesToDelete = oldHashes.filter((oldHashRow: any) => {
      return !newHashes.some((newHashRow: any) => oldHashRow.hash === newHashRow.hash);
    });

    // getObject hashes to putObject with deep object equality
    // putObject/update hash row if new hash row doesn't match to an old one
    const hashesToPut = newHashes.filter((newHashRow: any) => {
      return !oldHashes.some((oldHashRow: any) => _.isEqual(newHashRow, oldHashRow));
    });

    // putObject hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow: any) => ({ hash: hashRow.hash, cube: document.id })));
    await cubeHash.batchPut(hashesToPut);

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    delete document.image;

    document.date = new Date().valueOf();
    await client.put(document);
  },
  putNewCube: async (document: any): Promise<any> => {
    const existing = await client.get(document.id);
    if (existing.Item) {
      throw new Error('This cube ID is already taken');
    }

    const hashRows = cubeHash.getHashRowsForMetadata(document as any);

    await cubeHash.batchPut(hashRows);

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    return client.put({
      ...document,
    });
  },
  putCards: async (document: any): Promise<any> => {
    // strip cards
    for (const [board, list] of Object.entries(document)) {
      if (board !== 'id') {
        stripDetails(list as any[]);
      }
    }

    return putObject(process.env.DATA_BUCKET!, `cube/${document.id}.json`, document);
  },
  batchPut: async (documents: any[]): Promise<void> => client.batchPut(documents),
  batchPutCards: async (documents: any[]): Promise<void> => {
    // strip cards
    for (const document of documents) {
      for (const [board, list] of Object.entries(document)) {
        if (board !== 'id') {
          stripDetails(list as any[]);
        }
      }
    }

    await Promise.all(
      documents.map((document: any) => putObject(process.env.DATA_BUCKET!, `cube/${document.id}.json`, document)),
    );
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  convertCubeToMetadata: (cube: any): any => ({
    [FIELDS.ID]: `${cube._id}`,
    [FIELDS.SHORT_ID]: cube.shortID,
    [FIELDS.OWNER]: `${cube.owner}`,
    [FIELDS.VISIBILITY]: getVisibility(cube.isListed, cube.isPrivate),
    [FIELDS.PRICE_VISIBILITY]: cube.privatePrices ? PRICE_VISIBILITY.PRIVATE : PRICE_VISIBILITY.PUBLIC,
    [FIELDS.FEATURED]: cube.isFeatured,
    [FIELDS.CATEGORY_OVERRIDE]: cube.overrideCategory ? cube.categoryOverride : null,
    [FIELDS.CATEGORY_PREFIXES]: cube.overrideCategory ? cube.categoryPrefixes : null,
    [FIELDS.TAG_COLORS]: cube.tag_colors.map((item: any) => ({ color: item.color, tag: item.tag })),
    [FIELDS.DEFAULT_DRAFT_FORMAT]: cube.defaultFormat,
    [FIELDS.NUM_DECKS]: cube.numDecks,
    [FIELDS.DESCRIPTION]: cube.description,
    [FIELDS.IMAGE_NAME]: cube.image_name,
    [FIELDS.DATE]: cube.date_updated.valueOf(),
    [FIELDS.DEFAULT_SORTS]: cube.default_sorts,
    [FIELDS.SHOW_UNSORTED]: cube.default_show_unsorted,
    [FIELDS.DRAFT_FORMATS]: (cube.formats || []).map((item: any) => {
      return {
        title: item.title,
        multiples: item.multiples,
        markdown: item.markdown,
        defaultStatus: item.defaultStatus,
        packs: (item.packs || []).map((pack: any) => {
          return {
            slots: pack.slots,
            steps: (pack.steps || []).map((step: any) => {
              return {
                action: step.action,
                amount: step.amount,
              };
            }),
          };
        }),
      };
    }),
    [FIELDS.USERS_FOLLOWING]: cube.users_following.map((id: any) => `${id}`),
    [FIELDS.DEFAULT_STATUS]: cube.defaultStatus,
    [FIELDS.DEFAULT_PRINTING]: cube.defaultPrinting,
    [FIELDS.DISABLE_NOTIFICATIONS]: cube.disableNotifications,
    [FIELDS.BASICS]: cube.basics || DEFAULT_BASICS,
    [FIELDS.TAGS]: cube.tags,
    [FIELDS.KEYWORDS]: cube.keywords,
    [FIELDS.NAME]: cube.name,
    [FIELDS.CARD_COUNT]: cube.cards.length,
  }),
  convertCubeToCards: (cube: any): any => {
    return {
      id: `${cube._id}`,
      mainboard: cube.cards
        .filter((card: any) => card)
        .map((card: any) => {
          delete card.scryfall_id;
          delete card.details;
          if (card.addedTmsp) {
            card.addedTmsp = card.addedTmsp.valueOf();
          } else {
            card.addedTmsp = new Date().valueOf() - MILLISECONDS_IN_YEAR * 3;
          }
          return card;
        }),
      maybeboard: cube.maybe
        .filter((card: any) => card)
        .map((card: any) => {
          delete card.scryfall_id;
          delete card.details;
          if (card.addedTmsp) {
            card.addedTmsp = card.addedTmsp.valueOf();
          } else {
            card.addedTmsp = new Date().valueOf() - MILLISECONDS_IN_YEAR * 3;
          }
          return card;
        }),
    };
  },
  VISIBILITY,
  PRICE_VISIBILITY,
  FIELDS,
};

module.exports = exportData;

export default exportData;
