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

const getCards = async (id) => {
  try {
    const res = await s3
      .getObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `cardlist/${id}.json`,
      })
      .promise();

    return JSON.parse(res.Body.toString());
  } catch (e) {
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
    return {};
  }
};

const addS3Fields = async (document) => {
  const cards = await getCards(document.DraftId || document.id);
  const seats = await getSeats(document.DraftId || document.id);

  return {
    ...document,
    seats: seats.seats,
    basics: seats.basics,
    InitialState: seats.InitialState,
    cards: addDetails(cards),
  };
};

// make sure all card references use the card array
const sanitize = (document) => {
  const { cards } = document;

  const indexify = (card) => {
    // if it's an array
    if (Array.isArray(card)) {
      return card.map((c) => indexify(c));
    }

    // if it's already index return it
    if (typeof card === 'number') {
      return card;
    }

    if (typeof card === 'object' && card !== null) {
      const index = cards.findIndex((c) => c.cardID === card.cardID);

      if (index === -1) {
        return cards.findIndex((c) => c._id && c._id.equals(card.cardID));
      }

      return index;
    }

    return -1;
  };

  for (const seat of document.seats) {
    if (seat.Deck) {
      seat.Deck = seat.Deck.map(indexify);
    }

    if (seat.Sideboard) {
      seat.Sideboard = seat.Sideboard.map(indexify);
    }

    if (seat.Pickorder) {
      seat.Pickorder = seat.Pickorder.map(indexify);
    }

    if (seat.Trashorder) {
      seat.Trashorder = seat.Trashorder.map(indexify);
    }
  }

  return document;
};

const draftIsCompleted = (draft) => {
  let numCards = 0;
  if (!draft.seats) {
    return false;
  }
  for (const seat of draft.seats) {
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
  batchGet: async (ids) => {
    const documents = await client.batchGet(ids);
    return Promise.all(documents.map((document) => addS3Fields(document)));
  },
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
        Body: JSON.stringify({ seats: document.seats, basics: document.basics, InitialState: document.InitialState }),
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
      [FIELDS.ID]: document[FIELDS.ID],
      [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.CUBE_OWNER]: document[FIELDS.CUBE_OWNER],
      [FIELDS.DATE]: document[FIELDS.DATE],
      [FIELDS.TYPE]: document[FIELDS.TYPE],
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
              seats: document.seats,
              basics: document.basics,
              InitialState: document.InitialState,
            }),
          })
          .promise();
      }),
    );
  },
  createTable: async () => client.createTable(),
  convertDeck: (deck, draft, type) => {
    try {
      let cardCount = 0;
      for (const row of deck.seats[0].deck) {
        for (const col of row) {
          cardCount += col.length;
        }
      }

      if (cardCount === 0) {
        return [];
      }

      let cards = [];
      let initialState = {};
      let seatsForPickOrder = {};

      if (type === TYPES.DRAFT) {
        draft.initial_state.map((seat) =>
          seat.map((pack) =>
            pack.cards.map((idx) => cards.findIndex((card) => draft.cards[idx].cardID === card.cardID)),
          ),
        );
        seatsForPickOrder = deck.seats;
        cards = deck.cards;
      } else if (type === TYPES.GRID) {
        initialState = draft.initial_state.map((pack) =>
          pack.map((idx) => cards.findIndex((card) => draft.cards[idx].cardID === card.cardID)),
        );
        seatsForPickOrder = draft.seats;
        cards = draft.cards;
      } else {
        seatsForPickOrder = deck.seats;
        cards = deck;
      }

      const doc = sanitize({
        [FIELDS.ID]: `${deck.draft || deck._id}`,
        [FIELDS.CUBE_ID]: `${deck.cube}`,
        [FIELDS.CUBE_OWNER]: `${deck.cubeOwner}`,
        [FIELDS.OWNER]: `${deck.owner}`,
        [FIELDS.DATE]: deck.date.valueOf(),
        basics: deck.basics.map((card) => parseInt(card, 10)),
        cards,
        seats: deck.seats.map((seat, index) => ({
          owner: `${seat.userid}`,
          Mainboard: seat.deck,
          Sideboard: seat.sideboard,
          Pickorder: seatsForPickOrder[index].pickorder,
          Trashorder: seat.trashorder,
          title: seat.name,
          body: seat.description,
          Bot: seat.bot,
        })),
        InitialState: initialState,
        [FIELDS.TYPE]: type,
      });

      return [doc];
    } catch (e) {
      console.log(`Erroring converting deck ${deck._id} of type ${type}`);
      console.log(e);
      return [];
    }
  },
  delete: async (id) => client.delete(id),
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
  FIELDS,
  TYPES,
};
