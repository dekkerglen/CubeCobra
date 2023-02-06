// dotenv
require('dotenv').config();

const _ = require('lodash');
const createClient = require('../util');
const s3 = require('../s3client');
const { getHashRowsForMetadata, getHashRowsForCube } = require('./cubeHash');
const cubeHash = require('./cubeHash');
const carddb = require('../../serverjs/carddb');

const DEFAULT_BASICS = [
  '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
  '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
  '19e71532-3f79-4fec-974f-b0e85c7fe701',
  '8365ab45-6d78-47ad-a6ed-282069b0fabc',
  '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
];

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
  });
};

const getCards = async (id) => {
  try {
    const res = await s3
      .getObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `cube/${id}.json`,
      })
      .promise();

    const cards = JSON.parse(res.Body.toString());
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
    return {
      mainboard: [],
      maybeboard: [],
    };
  }
};

module.exports = {
  getCards,
  updateCards: async (id, newCards) => {
    const oldCards = await getCards(id);

    const oldMetadata = (await client.get(id)).Item;
    const newMetadata = JSON.parse(JSON.stringify(oldMetadata));

    const main = newCards.mainboard;
    newMetadata.cardCount = main.length;

    const oldHashes = getHashRowsForCube(oldMetadata, oldCards);
    const newHashes = getHashRowsForCube(newMetadata, newCards);

    // get hashes to delete with deep object equality
    // delete old hash row if no new hash row has this hash
    const hashesToDelete = oldHashes.filter((oldHashRow) => {
      return !newHashes.some((newHashRow) => oldHashRow.hash === newHashRow.hash);
    });

    // get hashes to put with deep object equality
    // put/update hash row if new hash row doesn't match to an old one
    const hashesToPut = newHashes.filter((newHashRow) => {
      return !oldHashes.some((oldHashRow) => _.isEqual(newHashRow, oldHashRow));
    });

    // put hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ hash: hashRow.hash, cube: id })));
    await cubeHash.batchPut(hashesToPut);

    // strip details from cards
    for (const [board, list] of Object.entries(newCards)) {
      if (board !== 'id') {
        stripDetails(list);
      }
    }

    await client.put(newMetadata);
    await s3
      .upload({
        Bucket: process.env.DATA_BUCKET,
        Key: `cube/${id}.json`,
        Body: JSON.stringify(newCards),
      })
      .promise();
  },
  deleteById: async (id) => {
    const document = (await client.get(id)).Item;
    const hashes = getHashRowsForMetadata(document);
    await cubeHash.batchDelete(hashes.map((hashRow) => ({ hash: hashRow.hash, cube: id })));
    await client.delete({ id });
    await s3.deleteObject({ Bucket: process.env.DATA_BUCKET, Key: `cube/${id}.json` }).promise();
  },
  getById: async (id) => {
    const byId = await client.get(id);
    if (byId.Item) {
      return byId.Item;
    }

    const byShortId = await cubeHash.getSortedByName(`shortid:${id}`);
    if (byShortId.items.length > 0) {
      const cubeId = byShortId.items[0].cube;
      const query = await client.get(cubeId);
      return query.Item;
    }

    return null;
  },
  batchGet: async (ids) => client.batchGet(ids),
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
      ScanIndexForward: true,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByVisibility: async (visibility, lastKey) => {
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
      ScanIndexForward: true,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  scan: async (lastKey, fields) => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
      ProjectionExpression: fields ? fields.join(',') : undefined,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByVisibilityBefore: async (visibility, before, lastKey) => {
    const result = await client.query({
      IndexName: 'ByVisiblity',
      KeyConditionExpression: `#p1 = :visibility and #p2 < :before`,
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':before': before,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.VISIBILITY,
        '#p2': FIELDS.DATE,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    });
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

    // get hashes to delete with deep object equality
    // delete old hash row if no new hash row has this hash
    const hashesToDelete = oldHashes.filter((oldHashRow) => {
      return !newHashes.some((newHashRow) => oldHashRow.hash === newHashRow.hash);
    });

    // get hashes to put with deep object equality
    // put/update hash row if new hash row doesn't match to an old one
    const hashesToPut = newHashes.filter((newHashRow) => {
      return !oldHashes.some((oldHashRow) => _.isEqual(newHashRow, oldHashRow));
    });

    // put hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ hash: hashRow.hash, cube: document.id })));
    await cubeHash.batchPut(hashesToPut);

    await client.put(document);
  },
  put: async (document) => {
    const hashRows = getHashRowsForMetadata(document);

    await cubeHash.batchPut(hashRows);

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

    return s3
      .upload({
        Bucket: process.env.DATA_BUCKET,
        Key: `cube/${document.id}.json`,
        Body: JSON.stringify(document),
      })
      .promise();
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
      documents.map((document) =>
        s3
          .upload({
            Bucket: process.env.DATA_BUCKET,
            Key: `cube/${document.id}.json`,
            Body: JSON.stringify(document),
          })
          .promise(),
      ),
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
      mainboard: cube.cards.map((card) => {
        delete card._id;
        delete card.details;
        if (card.addedTmsp) {
          card.addedTmsp = card.addedTmsp.valueOf();
        } else {
          card.addedTmsp = new Date().valueOf() - MILLISECONDS_IN_YEAR * 3;
        }
        return card;
      }),
      maybeboard: cube.maybe.map((card) => {
        delete card._id;
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
