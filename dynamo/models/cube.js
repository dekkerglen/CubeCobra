// dotenv
require('dotenv').config();

const _ = require('lodash');
const createClient = require('../util');
const s3 = require('../s3client');
const { getHashRowsForMetadata, getHashRowsForCube } = require('./cubeHash');
const cubeHash = require('./cubeHash');
const carddb = require('../../serverjs/cards');

const { DEFAULT_BASICS } = require('../../routes/cube/helper');

const MILLISECONDS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

const FIELDS = {
  ID: 'Id',
  SHORT_ID: 'ShortId',
  OWNER: 'Owner',
  NAME: 'Name',
  VISIBILITY: 'Visibility',
  PRICE_VISIBLITY: 'PriceVisibility',
  FEATURED: 'Featured',
  CATEGORY_OVERRIDE: 'CategoryOverride',
  CATEGORY_PREFIXES: 'CategoryPrefixes',
  TAG_COLORS: 'TagColors',
  DEFAULT_DRAFT_FORMAT: 'DefaultDraftFormat',
  NUM_DECKS: 'NumDecks',
  DESCRIPTION: 'Description',
  IMAGE_NAME: 'ImageName',
  DATE: 'Date',
  DEFAULT_SORTS: 'DefaultSorts',
  SHOW_UNSORTED: 'ShowUnsorted',
  DRAFT_FORMATS: 'DraftFormats',
  USERS_FOLLOWING: 'UsersFollowing',
  DEFAULT_STATUS: 'DefaultStatus',
  DEFAULT_PRINTING: 'DefaultPrinting',
  DISABLE_NOTIFICATIONS: 'DisableNotifications',
  BASICS: 'Basics',
  TAGS: 'Tags',
  KEYWORDS: 'Keywords',
  CARD_COUNT: 'CardCount',
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
    console.log(e);
    return {
      Mainboard: [],
      Maybeboard: [],
    };
  }
};

module.exports = {
  getCards,
  updateCards: async (id, newCards) => {
    const oldCards = getCards(id);

    const oldMetadata = (await client.get(id)).Item;
    const newMetadata = JSON.parse(JSON.stringify(oldMetadata));

    const main = newCards.Mainboard;
    newMetadata.CardCount = main.length;

    const oldHashes = getHashRowsForCube(oldMetadata, oldCards);
    const newHashes = getHashRowsForCube(newMetadata, newCards);

    // get hashes to delete with deep object equality
    // delete old hash row if no new hash row has this hash
    const hashesToDelete = oldHashes.filter((oldHashRow) => {
      return !newHashes.some((newHashRow) => oldHashRow.Hash === newHashRow.Hash);
    });

    // get hashes to put with deep object equality
    // put/update hash row if new hash row doesn't match to an old one
    const hashesToPut = newHashes.filter((newHashRow) => {
      return !oldHashes.some((oldHashRow) => _.isEqual(newHashRow, oldHashRow));
    });

    // put hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ Hash: hashRow.Hash, CubeId: id })));
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
    await cubeHash.batchDelete(hashes.map((hashRow) => ({ Hash: hashRow.Hash, CubeId: id })));
    await client.delete({ Id: id });
    await s3.deleteObject({ Bucket: process.env.DATA_BUCKET, Key: `cube/${id}.json` }).promise();
  },
  getById: async (id) => {
    const byId = await client.get(id);
    if (byId.Item) {
      return byId.Item;
    }

    const byShortId = await cubeHash.getSortedByName(`shortid:${id}`);
    if (byShortId.items.length > 0) {
      const cubeId = byShortId.items[0].CubeId;
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
    const oldDocument = (await client.get(document.Id)).Item;

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
      return !newHashes.some((newHashRow) => oldHashRow.Hash === newHashRow.Hash);
    });

    // get hashes to put with deep object equality
    // put/update hash row if new hash row doesn't match to an old one
    const hashesToPut = newHashes.filter((newHashRow) => {
      return !oldHashes.some((oldHashRow) => _.isEqual(newHashRow, oldHashRow));
    });

    // put hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ Hash: hashRow.Hash, CubeId: document.Id })));
    await cubeHash.batchPut(hashesToPut);

    await client.put(document);
  },
  put: async (document) => {
    const hashRows = getHashRowsForMetadata(document);

    console.log(hashRows);
    await cubeHash.batchPut(hashRows);

    console.log(document);
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
        Key: `cube/${document}.json`,
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
    [FIELDS.DRAFT_FORMATS]: (cube.draft_formats || []).map((item) => {
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
      Mainboard: cube.cards.map((card) => {
        delete card._id;
        delete card.details;
        if (card.addedTmsp) {
          card.addedTmsp = card.addedTmsp.valueOf();
        } else {
          card.addedTmsp = new Date().valueOf() - MILLISECONDS_IN_YEAR * 3;
        }
        return card;
      }),
      Maybeboard: cube.maybe.map((card) => {
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
