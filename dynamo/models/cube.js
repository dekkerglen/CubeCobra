const _ = require('lodash');
const createClient = require('../util');
const s3 = require('../s3client');
const { getHashRowsForMetadata, getHashRowsForCube } = require('./cubeHash');
const cubeHash = require('./cubeHash');

const { DEFAULT_BASICS } = require('../../routes/cube/helper');

const MILLISECONDS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

const FIELDS = {
  ID: 'Id',
  SHORT_ID: 'ShortId',
  OWNER: 'Owner',
  NAME: 'Name',
  VISIBLITY: 'Visibility',
  PRICE_VISIBLITY: 'PriceVisibility',
  FEATURED: 'Featured',
  CATEGORY_OVERRIDE: 'CategoryOverride',
  CATEGORY_PREFIXES: 'CategoryPrefixes',
  TAG_COLORS: 'TagColors',
  DEFAULT_DRAFT_FORMAT: 'DefaultDraftFormat',
  NUM_DECKS: 'NumDecks',
  DESCRIPTION: 'Description',
  IMAGE_URI: 'ImageUri',
  IMAGE_ARTIST: 'ImageArtist',
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

const VISIBLITY = {
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
    return VISIBLITY.PRIVATE;
  }
  if (!isListed) {
    return VISIBLITY.UNLISTED;
  }
  return VISIBLITY.PUBLIC;
};

const client = createClient({
  name: 'CUBE_METADATA',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.OWNER]: 'S',
    [FIELDS.VISIBLITY]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
      name: 'ByOwner',
    },
    {
      partitionKey: FIELDS.VISIBLITY,
      sortKey: FIELDS.DATE,
      name: 'ByVisiblity',
    },
  ],
  FIELDS,
});

const deepFreeze = (object) => {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);

  // Freeze properties before freezing self

  for (const name of propNames) {
    const value = object[name];

    if (value && typeof value === 'object') {
      Object.freeze(value);
    }
  }

  return Object.freeze(object);
};

const deepClone = (object) => {
  return JSON.parse(JSON.stringify(object));
};

module.exports = {
  getCards: async (id) => {
    const res = s3
      .getObject({
        Bucket: 'cubecobra',
        Key: `cube/${id}.json`,
      })
      .promise();
    return deepFreeze(res.Body);
  },
  updateCards: async (id, oldCards, newCards) => {
    const oldMetadata = (await client.get(id)).Item;
    const newMetadata = deepClone(oldMetadata);
    const main = newCards.boards.filter((board) => board.name === 'Mainboard');
    newMetadata.CardCount = main.cards.length;

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

    console.log(hashesToDelete);
    console.log(hashesToPut);

    // put hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ Hash: hashRow.Hash, CubeId: id })));
    await cubeHash.batchPut(hashesToPut);

    await s3
      .upload({
        Bucket: 'cubecobra',
        Key: `cube/${id}.json`,
        Body: JSON.stringify(newCards),
      })
      .promise();
  },
  getById: async (id) => deepFreeze((await client.get(id)).Item),
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
        '#p1': FIELDS.VISIBLITY,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    });
    return {
      items: deepFreeze(result.Items),
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
        '#p1': FIELDS.VISIBLITY,
        '#p2': FIELDS.DATE,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    });
    return {
      items: deepFreeze(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (oldDocument, newDocument) => {
    if (_.isEqual(oldDocument, newDocument)) {
      return;
    }

    if (!newDocument[FIELDS.ID]) {
      throw new Error('Invalid document: No partition key provided');
    }

    const oldHashes = getHashRowsForMetadata(oldDocument);
    const newHashes = getHashRowsForMetadata(newDocument);

    console.log(oldHashes);
    console.log(newHashes);

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

    console.log(hashesToDelete);
    console.log(hashesToPut);

    // put hashes to delete
    await cubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ Hash: hashRow.Hash, CubeId: newDocument.Id })));
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
    return s3
      .upload({
        Bucket: 'cubecobra',
        Key: `cube/${document}.json`,
        Body: JSON.stringify(document),
      })
      .promise();
  },
  batchPut: async (documents) => client.batchPut(documents),
  batchPutCards: async (documents) => {
    await Promise.all(
      documents.map((document) =>
        s3
          .upload({
            Bucket: 'cubecobra',
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
    [FIELDS.VISIBLITY]: getVisibility(cube.isListed, cube.isPrivate),
    [FIELDS.PRICE_VISIBLITY]: cube.privatePrices ? PRICE_VISIBLITY.PRIVATE : PRICE_VISIBLITY.PUBLIC,
    [FIELDS.FEATURED]: cube.isFeatured,
    [FIELDS.CATEGORY_OVERRIDE]: cube.overrideCategory ? cube.categoryOverride : null,
    [FIELDS.CATEGORY_PREFIXES]: cube.overrideCategory ? cube.categoryPrefixes : null,
    [FIELDS.TAG_COLORS]: cube.tag_colors.map((item) => ({ color: item.color, tag: item.tag })),
    [FIELDS.DEFAULT_DRAFT_FORMAT]: cube.defaultDraftFormat,
    [FIELDS.NUM_DECKS]: cube.numDecks,
    [FIELDS.DESCRIPTION]: cube.description,
    [FIELDS.IMAGE_URI]: cube.image_uri,
    [FIELDS.IMAGE_ARTIST]: cube.image_artist,
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
      boards: [
        {
          name: 'Mainboard',
          cards: cube.cards.map((card) => {
            delete card._id;
            if (card.addedTmsp) {
              card.addedTmsp = card.addedTmsp.valueOf();
            } else {
              card.addedTmsp = new Date().valueOf() - MILLISECONDS_IN_YEAR * 3;
            }
            return card;
          }),
        },
        {
          name: 'Maybeboard',
          cards: cube.maybe.map((card) => {
            delete card._id;
            if (card.addedTmsp) {
              card.addedTmsp = card.addedTmsp.valueOf();
            } else {
              card.addedTmsp = new Date().valueOf() - MILLISECONDS_IN_YEAR * 3;
            }
            return card;
          }),
        },
      ],
    };
  },
  VISIBLITY,
  PRICE_VISIBLITY,
  FIELDS,
  deepClone,
};
