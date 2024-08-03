// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');
const createClient = require('../util');
const { getObject, putObject } = require('../s3client');
const carddb = require('../../serverjs/carddb');
const cardutil = require('../../dist/utils/Card');

const CARD_LIMIT = 10000;

const FIELDS = {
  CUBE_ID: 'cube',
  DATE: 'date',
  ID: 'id',
};

const client = createClient({
  name: 'CUBE_CHANGELOG',
  partitionKey: FIELDS.CUBE_ID,
  sortKey: FIELDS.DATE,
  attributes: {
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

const BLOG_HTML_PARSE = />([^</]+)<\//g;

const sanitizeChangelog = (changelog) => {
  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      for (let i = 0; i < value.adds.length; i++) {
        delete value.adds[i].details;
      }
    }
    if (value.removes) {
      for (let i = 0; i < value.removes.length; i++) {
        delete value.removes[i].oldCard.details;
      }
    }
    if (value.swaps) {
      for (let i = 0; i < value.swaps.length; i++) {
        delete value.swaps[i].oldCard.details;
        delete value.swaps[i].card.details;
      }
    }
    if (value.edits) {
      for (let i = 0; i < value.edits.length; i++) {
        delete value.edits[i].oldCard.details;
        delete value.edits[i].newCard.details;
      }
    }
  }
  return changelog;
};

const hydrateChangelog = (changelog) => {
  let totalCards = 0;

  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      totalCards += value.adds.length;
    }
    if (value.removes) {
      totalCards += value.removes.length;
    }
    if (value.swaps) {
      totalCards += value.swaps.length;
    }
    if (value.edits) {
      totalCards += value.edits.length;
    }
  }

  if (totalCards > CARD_LIMIT) {
    throw new Error('Too many cards to load this changelog');
  }

  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      for (let i = 0; i < value.adds.length; i++) {
        value.adds[i].details = {
          ...carddb.cardFromId(value.adds[i].cardID),
        };
      }
    }
    if (value.removes) {
      for (let i = 0; i < value.removes.length; i++) {
        value.removes[i].oldCard.details = {
          ...carddb.cardFromId(value.removes[i].oldCard.cardID),
        };
      }
    }
    if (value.swaps) {
      for (let i = 0; i < value.swaps.length; i++) {
        value.swaps[i].oldCard.details = {
          ...carddb.cardFromId(value.swaps[i].oldCard.cardID),
        };
        value.swaps[i].card.details = {
          ...carddb.cardFromId(value.swaps[i].card.cardID),
        };
      }
    }
    if (value.edits) {
      for (let i = 0; i < value.edits.length; i++) {
        value.edits[i].oldCard.details = {
          ...carddb.cardFromId(value.edits[i].oldCard.cardID),
        };
        value.edits[i].newCard.details = {
          ...carddb.cardFromId(value.edits[i].newCard.cardID),
        };
      }
    }
  }
  return changelog;
};

const getChangelog = async (cubeId, id) => {
  const changelog = await getObject(process.env.DATA_BUCKET, `changelog/${cubeId}/${id}.json`);

  return hydrateChangelog(changelog);
};

const parseHtml = (html) => {
  const changelog = {
    mainboard: {},
  };

  const items = html.split(/<\/?br\/?>/g);
  for (const item of items) {
    const tokens = [...item.matchAll(BLOG_HTML_PARSE)].map(([, token]) => token);
    if (tokens.length === 2) {
      const [operator, cardname] = tokens;
      const name = cardutil.normalizeName(cardname);
      const ids = carddb.nameToId[name];

      if (operator === '+') {
        if (!changelog.mainboard.adds) {
          changelog.mainboard.adds = [];
        }
        if (ids) {
          changelog.mainboard.adds.push({ cardID: ids[0] });
        }
      } else if (operator === '-' || operator === '–') {
        if (!changelog.mainboard.removes) {
          changelog.mainboard.removes = [];
        }
        if (ids) {
          changelog.mainboard.removes.push({ oldCard: { cardID: ids[0] } });
        }
      }
    } else if (tokens.length === 3) {
      const [operator, removed, added] = tokens;
      if (operator === '→') {
        if (!changelog.mainboard.swaps) {
          changelog.mainboard.swaps = [];
        }

        const addedIds = carddb.nameToId[cardutil.normalizeName(added)];
        const removedIds = carddb.nameToId[cardutil.normalizeName(removed)];

        if (addedIds && removedIds) {
          changelog.mainboard.swaps.push({
            oldCard: { cardID: removedIds[0] },
            card: { cardID: addedIds[0] },
          });
        }
      }
    }
  }

  return changelog;
};

module.exports = {
  getById: getChangelog,
  getByCube: async (cubeId, limit, lastKey) => {
    const result = await client.query({
      KeyConditionExpression: `#p1 = :cube`,
      ExpressionAttributeValues: {
        ':cube': cubeId,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.CUBE_ID,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 36,
    });

    const items = await Promise.all(
      result.Items.map(async (item) => ({
        cubeId,
        date: item.date,
        changelog: await getChangelog(cubeId, item[FIELDS.ID]),
      })),
    );

    return {
      items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (changelog, cube) => {
    const id = uuid();
    await putObject(process.env.DATA_BUCKET, `changelog/${cube}/${id}.json`, sanitizeChangelog(changelog));
    await client.put({
      [FIELDS.ID]: id,
      [FIELDS.CUBE_ID]: cube,
      [FIELDS.DATE]: new Date().valueOf(),
    });
    return id;
  },
  batchPut: async (documents) => {
    await client.batchPut(
      documents.map((document) => ({
        [FIELDS.ID]: document.id,
        [FIELDS.CUBE_ID]: document.cubeId,
        [FIELDS.DATE]: document.date || Date.now().valueOf(),
      })),
    );
    await Promise.all(
      documents.map(async (document) =>
        putObject(
          process.env.DATA_BUCKET,
          `changelog/${document.cubeId}/${document.id}.json`,
          sanitizeChangelog(document.changelog),
        ),
      ),
    );
  },
  createTable: async () => client.createTable(),
  getChangelogFromBlog: (blog) => {
    const { cube, date } = blog;

    let changelog = null;
    if (blog.changed_cards) {
      changelog = {
        mainboard: {},
      };
      for (const { removedID, addedID } of blog.changed_cards) {
        if (addedID && removedID) {
          // swap
          if (!changelog.mainboard.swaps) {
            changelog.mainboard.swaps = [];
          }
          changelog.mainboard.swaps.push({
            card: { cardID: addedID },
            oldCard: { cardID: removedID },
          });
        } else if (addedID) {
          // add
          if (!changelog.mainboard.adds) {
            changelog.mainboard.adds = [];
          }
          changelog.mainboard.adds.push({ cardID: addedID });
        } else if (removedID) {
          // remove
          if (!changelog.mainboard.removes) {
            changelog.mainboard.removes = [];
          }
          changelog.mainboard.removes.push({
            oldCard: { cardID: removedID },
          });
        }
      }
    } else if (blog.changelist) {
      changelog = parseHtml(blog.changelist);
    } else if (blog.html && blog.html.includes('span')) {
      changelog = parseHtml(blog.html);
    }

    if (!changelog || Object.entries(changelog.mainboard).length === 0) {
      return [];
    }

    return [
      {
        id: `${blog._id}`,
        cubeId: `${cube}`,
        changelog,
        date: date.valueOf() || Date.now().valueOf(),
      },
    ];
  },
  scan: async (limit, lastKey) => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      Limit: limit || 36,
    });

    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchGet: async (keys) => {
    const result = await Promise.all(
      keys.map(async (key) => {
        const data = await getObject(process.env.DATA_BUCKET, `changelog/${key.cube}/${key.id}.json`);
        try {
          const hydrated = hydrateChangelog(data);
          return hydrated;
        } catch {
          return data;
        }
      }),
    );

    return result;
  },
  FIELDS,
};
