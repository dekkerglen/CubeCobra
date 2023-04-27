// dotenv
require('dotenv').config();

const _ = require('lodash');
const { getImageData } = require('../../serverjs/util');
const createClient = require('../util');
const { getObject, putObject, deleteObject } = require('../s3client');
const { getHashRowsForMetadata } = require('./cubeHash');
const cubeHash = require('./cubeHash');
const User = require('./user');
const carddb = require('../../serverjs/carddb');
const cloudwatch = require('../../serverjs/cloudwatch');

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
  PRICE_VISIBLITY: 'priceVisibility',
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
  DRAFT_FORMATS: 'formats',
  USERS_FOLLOWING: 'following',
  DEFAULT_STATUS: 'defaultStatus',
  DEFAULT_PRINTING: 'defaultPrinting',
  DISABLE_NOTIFICATIONS: 'disableAlerts',
  BASICS: 'basics',
  TAGS: 'tags',
  KEYWORDS: 'keywords',
  CARD_COUNT: 'cardCount',
};

const VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
  UNLISTED: 'un',
};

const PRICE_VISIBLITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
};

const getVisibility = (isListed, isPrivate) => {
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
  FIELDS,
});

const addDetails = (cards) => {
  cards.forEach((card, index) => {
    card.details = {
      ...carddb.cardFromId(card.cardID),
    };
    card.index = index;
  });
};

const stripDetails = (cards) => {
  cards.forEach((card) => {
    delete card.details;
    delete card.index;
    delete card.board;
    delete card.editIndex;

    if (card.tags) {
      card.tags = card.tags.map((tag) => {
        if (typeof tag === 'object') {
          return tag.text;
        }
        return tag;
      });
    }
  });
};

const getCards = async (id, skipcache = false) => {
  try {
    const cards = await getObject(process.env.DATA_BUCKET, `cube/${id}.json`, skipcache);

    const totalCardCount = cards.mainboard.length + cards.maybeboard.length;

    if (totalCardCount > CARD_LIMIT) {
      throw new Error(`Cannot load cube: ${id} - too many cards: ${totalCardCount}`);
    }

    for (const [board, list] of Object.entries(cards)) {
      if (board !== 'id') {
        addDetails(list);
        for (let i = 0; i < list.length; i++) {
          [i].index = i;
          list[i].board = board;
        }
      }
    }
    return cards;
  } catch (e) {
    cloudwatch.error(`Failed to load cards for cube: ${id} - ${e.message}`, e.stack);
    throw new Error(`Failed to load cards for cube: ${id} - ${e.message}`);
  }
};

const hydrate = async (cube) => {
  if (!cube) {
    return cube;
  }

  cube.owner = await User.getById(cube.owner);
  cube.image = getImageData(cube.imageName);

  return cube;
};

const batchHydrate = async (cubes) => {
  const owners = await User.batchGet(cubes.map((cube) => cube.owner).filter((owner) => owner));

  return cubes.map((cube) => {
    cube.owner = owners.find((owner) => owner.id === cube.owner);
    cube.image = getImageData(cube.imageName);
    return cube;
  });
};

const numNull = (arr) => {
  const serialized = JSON.stringify(arr);
  const parsed = JSON.parse(serialized);

  return parsed.filter((card) => card === null).length;
};

module.exports = {
  getCards,
  updateCards: async (id, newCards) => {
    const nullCards = numNull(newCards.mainboard) + numNull(newCards.maybeboard);

    if (nullCards > 0) {
      throw new Error(`Cannot save cube: ${nullCards} null cards`);
    }

    const oldMetadata = (await client.get(id)).Item;
    const newMetadata = JSON.parse(JSON.stringify(oldMetadata));

    const main = newCards.mainboard;
    newMetadata.cardCount = main.length;

    const totalCards = main.length + newCards.maybeboard.length;

    if (totalCards > CARD_LIMIT) {
      throw new Error(`Cannot save cube: too many cards (${totalCards}/${CARD_LIMIT})`);
    }

    // strip details from cards
    for (const [board, list] of Object.entries(newCards)) {
      if (board !== 'id') {
        stripDetails(list);
      }
    }

    await client.put(newMetadata);
    await putObject(process.env.DATA_BUCKET, `cube/${id}.json`, newCards);
  },
  deleteById: async (id) => {
    const document = (await client.get(id)).Item;
    const hashes = getHashRowsForMetadata(document);
    await cubeHash.batchDelete(hashes.map((hashRow) => ({ hash: hashRow.hash, cube: id })));
    await client.delete({ id });
    await deleteObject(process.env.DATA_BUCKET, `cube/${id}.json`);
  },
  getById: async (id, skipCache = false) => {
    const byId = await client.get(id, skipCache);
    if (byId.Item) {
      return hydrate(byId.Item);
    }

    const byShortId = await cubeHash.getSortedByName(`shortid:${id}`);
    if (byShortId.items.length > 0) {
      const cubeId = byShortId.items[0].cube;
      const query = await client.get(cubeId, skipCache);
      return hydrate(query.Item);
    }

    return null;
  },
  batchGet: async (ids) => (await batchHydrate(await client.batchGet(ids))).filter((cube) => cube),
  batchGetUnhydrated: async (ids) => client.batchGet(ids),
  getByOwner: async (owner, lastKey) => {
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
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByVisibility: async (visibility, lastKey, limit = 36) => {
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
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  scan: async (lastKey) => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    });
    // this is only used for fixing hashes, so we don't need to hydrate
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document) => {
    const oldDocument = (await client.get(document.id)).Item;

    if (_.isEqual(oldDocument, document)) {
      return;
    }

    if (!document[FIELDS.ID]) {
      throw new Error('Invalid document: No partition key provided');
    }

    const oldHashes = getHashRowsForMetadata(oldDocument);
    const newHashes = getHashRowsForMetadata(document);

    // getObject hashes to delete with deep object equality
    // delete old hash row if no new hash row has this hash
    const hashesToDelete = oldHashes.filter((oldHashRow) => {
      return !newHashes.some((newHashRow) => oldHashRow.hash === newHashRow.hash);
    });

    // getObject hashes to putObject with deep object equality
    // putObject/update hash row if new hash row doesn't match to an old one
    const hashesToPut = newHashes.filter((newHashRow) => {
      return !oldHashes.some((oldHashRow) => _.isEqual(newHashRow, oldHashRow));
    });

    // putObject hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ hash: hashRow.hash, cube: document.id })));
    await cubeHash.batchPut(hashesToPut);

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    delete document.image;

    await client.put(document);
  },
  putNewCube: async (document) => {
    const existing = await client.get(document.id);
    if (existing.Item) {
      throw new Error('This cube ID is already taken');
    }

    const hashRows = getHashRowsForMetadata(document);

    await cubeHash.batchPut(hashRows);

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    return client.put({
      ...document,
    });
  },
  putCards: async (document) => {
    // strip cards
    for (const [board, list] of Object.entries(document)) {
      if (board !== 'id') {
        stripDetails(list);
      }
    }

    return putObject(process.env.DATA_BUCKET, `cube/${document.id}.json`, document);
  },
  batchPut: async (documents) => client.batchPut(documents),
  batchPutCards: async (documents) => {
    // strip cards
    for (const document of documents) {
      for (const [board, list] of Object.entries(document)) {
        if (board !== 'id') {
          stripDetails(list);
        }
      }
    }

    await Promise.all(
      documents.map((document) => putObject(process.env.DATA_BUCKET, `cube/${document.id}.json`, document)),
    );
  },
  createTable: async () => client.createTable(),
  convertCubeToMetadata: (cube) => ({
    [FIELDS.ID]: `${cube._id}`,
    [FIELDS.SHORT_ID]: cube.shortID,
    [FIELDS.OWNER]: `${cube.owner}`,
    [FIELDS.VISIBILITY]: getVisibility(cube.isListed, cube.isPrivate),
    [FIELDS.PRICE_VISIBLITY]: cube.privatePrices ? PRICE_VISIBLITY.PRIVATE : PRICE_VISIBLITY.PUBLIC,
    [FIELDS.FEATURED]: cube.isFeatured,
    [FIELDS.CATEGORY_OVERRIDE]: cube.overrideCategory ? cube.categoryOverride : null,
    [FIELDS.CATEGORY_PREFIXES]: cube.overrideCategory ? cube.categoryPrefixes : null,
    [FIELDS.TAG_COLORS]: cube.tag_colors.map((item) => ({ color: item.color, tag: item.tag })),
    [FIELDS.DEFAULT_DRAFT_FORMAT]: cube.defaultDraftFormat,
    [FIELDS.NUM_DECKS]: cube.numDecks,
    [FIELDS.DESCRIPTION]: cube.description,
    [FIELDS.IMAGE_NAME]: cube.image_name,
    [FIELDS.DATE]: cube.date_updated.valueOf(),
    [FIELDS.DEFAULT_SORTS]: cube.default_sorts,
    [FIELDS.SHOW_UNSORTED]: cube.default_show_unsorted,
    [FIELDS.DRAFT_FORMATS]: (cube.formats || []).map((item) => {
      return {
        title: item.title,
        multiples: item.multiples,
        markdown: item.markdown,
        defaultStatus: item.defaultStatus,
        packs: (item.packs || []).map((pack) => {
          return {
            slots: pack.slots,
            steps: (pack.steps || []).map((step) => {
              return {
                action: step.action,
                amount: step.amount,
              };
            }),
          };
        }),
      };
    }),
    [FIELDS.USERS_FOLLOWING]: cube.users_following.map((id) => `${id}`),
    [FIELDS.DEFAULT_STATUS]: cube.defaultStatus,
    [FIELDS.DEFAULT_PRINTING]: cube.defaultPrinting,
    [FIELDS.DISABLE_NOTIFICATIONS]: cube.disableNotifications,
    [FIELDS.BASICS]: cube.basics || DEFAULT_BASICS,
    [FIELDS.TAGS]: cube.tags,
    [FIELDS.KEYWORDS]: cube.keywords,
    [FIELDS.NAME]: cube.name,
    [FIELDS.CARD_COUNT]: cube.cards.length,
  }),
  convertCubeToCards: (cube) => {
    return {
      id: `${cube._id}`,
      mainboard: cube.cards
        .filter((card) => card)
        .map((card) => {
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
        .filter((card) => card)
        .map((card) => {
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
  PRICE_VISIBLITY,
  FIELDS,
};
