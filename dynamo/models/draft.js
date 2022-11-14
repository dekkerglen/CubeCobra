// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');
const createClient = require('../util');
const carddb = require('../../serverjs/cards');
const s3 = require('../s3client');

const FIELDS = {
  ID: 'id',
  CUBE_ID: 'cube',
  OWNER: 'owner',
  CUBE_OWNER: 'cubeOwner',
  DATE: 'date',
  TYPE: 'type',
};

const TYPES = {
  GRID: 'g',
  DRAFT: 'd',
  UPLOAD: 'u',
  SEALED: 's',
};

const client = createClient({
  name: 'DRAFT',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.CUBE_OWNER]: 'S',
    [FIELDS.OWNER]: 'S',
    [FIELDS.DATE]: 'N',
  },
  indexes: [
    {
      name: 'ByOwner',
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
    },
    {
      name: 'ByCube',
      partitionKey: FIELDS.CUBE_ID,
      sortKey: FIELDS.DATE,
    },
    {
      name: 'ByCubeOwner',
      partitionKey: FIELDS.CUBE_OWNER,
      sortKey: FIELDS.DATE,
    },
  ],
  FIELDS,
});

// LRU cache for cards
const cardsCache = {};
const MAX_CACHE_SIZE = 1000;

const evictOldest = () => {
  const oldest = Object.entries(cardsCache).sort(([, valuea], [, valueb]) => valuea.date.localeCompare(valueb.date));
  delete cardsCache[oldest[0][0]];
};

const getCards = async (id) => {
  try {
    if (cardsCache[id]) {
      return cardsCache[id].document;
    }

    const res = await s3
      .getObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `cardlist/${id}.json`,
      })
      .promise();

    const cards = JSON.parse(res.Body.toString());

    if (Object.keys(cardsCache).length >= MAX_CACHE_SIZE) {
      evictOldest();
    }

    cardsCache[id] = {
      date: new Date(),
      document: cards,
    };

    return cards;
  } catch (e) {
    console.log(e);
    return [];
  }
};

const addDetails = (cards) => {
  cards.forEach((card) => {
    card.details = {
      ...carddb.cardFromId(card.cardID),
    };
  });
  return cards;
};

const stripDetails = (cards) => {
  cards.forEach((card) => {
    delete card.details;
  });
  return cards;
};

const getSeats = async (id) => {
  try {
    const res = await s3
      .getObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `seats/${id}.json`,
      })
      .promise();

    return JSON.parse(res.Body.toString());
  } catch (e) {
    console.log(e);
    return {};
  }
};

const addS3Fields = async (document) => {
  const cards = await getCards(document.DraftId || document.id);
  const seats = await getSeats(document.DraftId || document.id);

  return {
    ...document,
    Seats: seats.Seats,
    basics: seats.basics,
    InitialState: seats.InitialState,
    cards: addDetails(cards),
  };
};

// make sure all card references use the card array
const sanitize = (document) => {
  const { cards } = document;
  for (const seat of document.Seats) {
    if (seat.Deck) {
      for (const row of seat.Mainboard) {
        for (const col of row) {
          for (let i = 0; i < col.length; i++) {
            const card = col[i];
            if (typeof card === 'object' && card !== null) {
              col[i] = cards.findIndex((c) => c.cardID === card.cardID);
            }
          }
        }
      }
    }

    if (seat.Sideboard) {
      for (const row of seat.Sideboard) {
        for (const col of row) {
          for (let i = 0; i < col.length; i++) {
            const card = col[i];
            if (typeof card === 'object' && card !== null) {
              col[i] = cards.findIndex((c) => c.cardID === card.cardID);
            }
          }
        }
      }
    }

    if (seat.Pickorder) {
      for (let i = 0; i < seat.Pickorder.length; i++) {
        const card = seat.Pickorder[i];
        if (typeof card === 'object' && card !== null) {
          seat.Pickorder[i] = cards.findIndex((c) => c.cardID === card.cardID);
        }
      }
    }

    if (seat.Trashorder) {
      for (let i = 0; i < seat.Trashorder.length; i++) {
        const card = seat.Trashorder[i];
        if (typeof card === 'object' && card !== null) {
          seat.Trashorder[i] = cards.findIndex((c) => c.cardID === card.cardID);
        }
      }
    }
  }

  return document;
};

const draftIsCompleted = (draft) => {
  let numCards = 0;
  if (!draft.Seats) {
    return false;
  }
  for (const seat of draft.Seats) {
    if (seat.Deck) {
      numCards += seat.Deck.reduce((acc, row) => acc + row.reduce((acc2, col) => acc2 + col.length, 0), 0);
    }
    if (seat.Sideboard) {
      numCards += seat.Sideboard.reduce((acc, row) => acc + row.reduce((acc2, col) => acc2 + col.length, 0), 0);
    }
  }
  return numCards > 0;
};

module.exports = {
  getById: async (id) => addS3Fields((await client.get(id)).Item),
  getByOwner: async (owner, lastKey) => {
    const res = await client.query({
      IndexName: 'ByOwner',
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: {
        '#owner': FIELDS.CUBE_OWNER,
      },
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: res.Items.filter((item) => draftIsCompleted(item)),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  getByCube: async (cubeId, lastKey) => {
    const res = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: '#cubeId = :cube',
      ExpressionAttributeNames: {
        '#cubeId': FIELDS.CUBE_ID,
      },
      ExpressionAttributeValues: {
        ':cube': cubeId,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: res.Items.filter((item) => draftIsCompleted(item)),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  getByCubeOwner: async (cubeOwner, lastKey) => {
    const res = await client.query({
      IndexName: 'ByCubeOwner',
      KeyConditionExpression: '#cubeOwner = :cubeOwner',
      ExpressionAttributeNames: {
        '#cubeOwner': FIELDS.CUBE_OWNER,
      },
      ExpressionAttributeValues: {
        ':cubeOwner': cubeOwner,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: res.Items.filter((item) => draftIsCompleted(item)),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    const id = document.id || uuid();
    await client.put({
      [FIELDS.ID]: id,
      [FIELDS.CUBE_ID]: document.cube,
      [FIELDS.OWNER]: document.owner,
      [FIELDS.CUBE_OWNER]: document.cubeOwner,
      [FIELDS.DATE]: document.date,
    });

    await s3
      .putObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `cardlist/${id}.json`,
        Body: JSON.stringify(stripDetails(document.cards)),
      })
      .promise();

    await s3
      .putObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `seats/${id}.json`,
        Body: JSON.stringify({ Seats: document.Seats, basics: document.basics, InitialState: document.InitialState }),
      })
      .promise();

    return id;
  },
  batchPut: async (documents) => {
    const filtered = [];
    const keys = new Set();

    for (const document of documents) {
      if (!keys.has(document.id)) {
        filtered.push(document);
        keys.add(document.id);
      }
    }

    const items = filtered.map((document) => ({
      [FIELDS.ID]: document.id,
      [FIELDS.CUBE_ID]: document.cube,
      [FIELDS.OWNER]: document.owner,
      [FIELDS.CUBE_OWNER]: document.cubeOwner,
      [FIELDS.DATE]: document.date,
      [FIELDS.TYPE]: document.type,
    }));

    await client.batchPut(items);

    await Promise.all(
      filtered.map(async (document) => {
        await s3
          .putObject({
            Bucket: process.env.DATA_BUCKET,
            Key: `cardlist/${document.id}.json`,
            Body: JSON.stringify(stripDetails(document.cards)),
          })
          .promise();
        await s3
          .putObject({
            Bucket: process.env.DATA_BUCKET,
            Key: `seats/${document.id}.json`,
            Body: JSON.stringify({
              Seats: document.Seats,
              basics: document.basics,
              InitialState: document.InitialState,
            }),
          })
          .promise();
      }),
    );
  },
  createTable: async () => client.createTable(),
  convertDeck: (deck) => {
    try {
      let cardCount = 0;
      for (const row of deck.Seats[0].deck) {
        for (const col of row) {
          cardCount += col.length;
        }
      }

      if (cardCount === 0) {
        return [];
      }

      const doc = sanitize({
        [FIELDS.ID]: `${deck.draft || deck._id}`,
        [FIELDS.CUBE_ID]: `${deck.cube}`,
        [FIELDS.CUBE_OWNER]: `${deck.cubeOwner}`,
        [FIELDS.OWNER]: `${deck.owner}`,
        [FIELDS.DATE]: deck.date.valueOf(),
        basics: deck.basics.map((card) => parseInt(card, 10)),
        cards: deck.cards,
        Seats: deck.Seats.map((seat) => ({
          owner: `${seat.userid}`,
          Mainboard: seat.deck,
          Sideboard: seat.sideboard,
          Pickorder: seat.pickorder,
          Trashorder: seat.trashorder,
          title: seat.name,
          body: seat.description,
          Bot: seat.bot,
        })),
        InitialState: deck.initial_state,
      });

      return [doc];
    } catch (e) {
      return [];
    }
  },
  updateDeckWithDraft: async (drafts) => {
    await Promise.all(
      drafts.map(async (draft) => {
        try {
          const seats = await getSeats(draft.id);

          if (Object.entries(seats).length === 0) {
            return;
          }

          let cards = null;
          for (let i = 0; i < draft.Seats.length; i++) {
            seats.Seats[i].Trashorder = draft.Seats[i].Trashorder;

            for (let j = 0; j < seats.Seats[i].Trashorder.length; j++) {
              const card = seats.Seats[i].Trashorder[j];
              if (typeof card === 'object' && card !== null) {
                // only load cards if we need them
                if (cards === null) {
                  // eslint-disable-next-line no-await-in-loop
                  cards = await getCards(draft.id);
                }

                seats.Seats[i].Trashorder[j] = cards.findIndex((c) => c.cardID === card.cardID);
              }
            }
          }
          await s3
            .putObject({
              Bucket: process.env.DATA_BUCKET,
              Key: `seats/${draft.id}.json`,
              Body: JSON.stringify(seats),
            })
            .promise();
        } catch (e) {
          console.log(e);
        }
      }),
    );
  },
  convertDraft: (draft) => {
    // trashorder

    if (!draft.Seats || !draft.Seats[0] || !draft.Seats[0].trashorder || draft.Seats[0].trashorder.length === 0) {
      return [];
    }

    return [
      {
        id: `${draft._id}`,
        Seats: draft.Seats.map((seat) => ({
          Trashorder: seat.trashorder.filter((value) => value),
        })),
      },
    ];
  },
  delete: async (id) => client.delete(id),
  FIELDS,
  TYPES,
};
