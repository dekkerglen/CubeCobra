require('dotenv').config();

const uuid = require('uuid/v4');
const createClient = require('../util');
const carddb = require('../../serverjs/carddb');
const { getObject, putObject } = require('../s3client');
const User = require('./user');
const Cube = require('./cube');

const FIELDS = {
  ID: 'id',
  CUBE_ID: 'cube',
  OWNER: 'owner',
  CUBE_OWNER: 'cubeOwner',
  DATE: 'date',
  TYPE: 'type',
  COMPLETE: 'complete',
  NAME: 'name',
  SEAT_NAMES: 'seatNames',
};

const TYPES = {
  GRID: 'g',
  DRAFT: 'd',
  UPLOAD: 'u',
  SEALED: 's',
};

const REVERSE_TYPES = {
  g: 'Grid Draft',
  d: 'Draft',
  u: 'Upload',
  s: 'Sealed',
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

const assessColors = (mainboard, cards) => {
  const colors = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  let count = 0;
  for (const card of mainboard.flat(3)) {
    const details = carddb.cardFromId(cards[card].cardID);
    if (!details.type.includes('Land')) {
      count += 1;
      for (const color of details.color_identity) {
        colors[color] += 1;
      }
    }
  }

  const threshold = 0.1;

  const colorKeysFiltered = Object.keys(colors).filter((color) => colors[color] / count > threshold);

  if (colorKeysFiltered.length === 0) {
    return ['C'];
  }

  return colorKeysFiltered;
};

const getCards = async (id) => {
  try {
    return getObject(process.env.DATA_BUCKET, `cardlist/${id}.json`);
  } catch (e) {
    return [];
  }
};

const addDetails = (cards) => {
  if (!cards) {
    return cards;
  }

  // if cards is string
  if (typeof cards === 'string') {
    try {
      cards = JSON.parse(cards);
    } catch (e) {
      return [];
    }
  }

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
    return getObject(process.env.DATA_BUCKET, `seats/${id}.json`);
  } catch (e) {
    return {};
  }
};

const addS3Fields = async (document) => {
  if (!document || !document.id) {
    return document;
  }

  const cards = await getCards(document.id);
  const seats = await getSeats(document.id);

  return {
    ...document,
    seats: seats.seats,
    basics: seats.basics,
    InitialState: seats.InitialState,
    cards: addDetails(cards, document.id),
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

    if (seat.sideboard) {
      seat.sideboard = seat.sideboard.map(indexify);
    }

    if (seat.pickorder) {
      seat.pickorder = seat.pickorder.map(indexify);
    }

    if (seat.trashorder) {
      seat.trashorder = seat.trashorder.map(indexify);
    }
  }

  return document;
};

const hydrate = async (document) => {
  if (!document) {
    return document;
  }

  const ids = [document.owner, document.cubeOwner];
  if (document.seats) {
    for (const seat of document.seats) {
      if (seat.owner) {
        ids.push(seat.owner);
      }
    }
  }

  const users = await User.batchGet(ids);

  document.owner = users.find((user) => user.id === document.owner);
  document.cubeOwner = users.find((user) => user.id === document.cubeOwner);

  if (!document.owner) {
    document.owner = {
      username: 'Anonymous',
      id: '404',
    };
  }

  if (!document.cubeOwner) {
    document.cubeOwner = {
      username: 'Anonymous',
      id: '404',
    };
  }

  if (document.seats) {
    for (const seat of document.seats) {
      if (seat.owner) {
        seat.owner = users.find((user) => user.id === seat.owner);
      }
    }
  }

  return document;
};

const dehydrate = (document) => {
  if (document.owner.id) {
    document.owner = document.owner.id;
  }

  if (document.cubeOwner.id) {
    document.cubeOwner = document.cubeOwner.id;
  }

  for (const seat of document.seats) {
    if (seat.owner && seat.owner.id) {
      seat.owner = seat.owner.id;
    }
  }

  return document;
};

const batchHydrate = async (documents) => {
  const ids = documents.map((document) => [document.owner, document.cubeOwner]).flat();

  for (const document of documents) {
    if (document.seats) {
      for (const seat of document.seats) {
        if (seat.owner) {
          ids.push(seat.owner);
        }
      }
    }
  }

  const users = await User.batchGet(ids);

  for (const document of documents) {
    document.owner = users.find((user) => user.id === document.owner);
    document.cubeOwner = users.find((user) => user.id === document.cubeOwner);

    if (!document.owner) {
      document.owner = {
        username: 'Anonymous',
        id: '404',
      };
    }

    if (!document.cubeOwner) {
      document.cubeOwner = {
        username: 'Anonymous',
        id: '404',
      };
    }

    if (document.seats) {
      for (const seat of document.seats) {
        if (seat.owner) {
          seat.owner = users.find((user) => user.id === seat.owner);
        }
      }
    }
  }

  return documents;
};

module.exports = {
  getById: async (id) => hydrate(await addS3Fields((await client.get(id)).Item)),
  batchGet: async (ids) => {
    const documents = await client.batchGet(ids);
    return batchHydrate(await Promise.all(documents.map((document) => addS3Fields(document))));
  },
  getByOwner: async (owner, lastKey) => {
    const res = await client.query({
      IndexName: 'ByOwner',
      KeyConditionExpression: '#owner = :owner',
      FilterExpression: '#complete = :complete',
      ExpressionAttributeNames: {
        '#owner': FIELDS.OWNER,
        '#complete': FIELDS.COMPLETE,
      },
      ExpressionAttributeValues: {
        ':owner': owner,
        ':complete': true,
      },
      Limit: 200,
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(res.Items),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  getByCube: async (cubeId, lastKey) => {
    const res = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: '#cubeId = :cube',
      FilterExpression: '#complete = :complete',
      ExpressionAttributeNames: {
        '#cubeId': FIELDS.CUBE_ID,
        '#complete': FIELDS.COMPLETE,
      },
      ExpressionAttributeValues: {
        ':cube': cubeId,
        ':complete': true,
      },
      Limit: 200,
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(res.Items),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  getByCubeOwner: async (cubeOwner, lastKey) => {
    const res = await client.query({
      IndexName: 'ByCubeOwner',
      KeyConditionExpression: '#cubeOwner = :cubeOwner',
      FilterExpression: '#complete = :complete',
      ExpressionAttributeNames: {
        '#cubeOwner': FIELDS.CUBE_OWNER,
        '#complete': FIELDS.COMPLETE,
      },
      ExpressionAttributeValues: {
        ':cubeOwner': cubeOwner,
        ':complete': true,
      },
      Limit: 200,
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(res.Items),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  put: async (document) => {
    const id = document.id || uuid();

    const names = document.seats.map((seat) => assessColors(seat.mainboard, document.cards).join(''));

    document = dehydrate(document);

    const cube = await Cube.getById(document.cube);

    await client.put({
      [FIELDS.ID]: id,
      [FIELDS.CUBE_ID]: document.cube,
      [FIELDS.OWNER]: document.owner,
      [FIELDS.CUBE_OWNER]: document.cubeOwner,
      [FIELDS.DATE]: document.date,
      [FIELDS.TYPE]: document.type,
      [FIELDS.COMPLETE]: document.complete,
      [FIELDS.NAME]: `${names[0]} ${REVERSE_TYPES[document.type]} of ${cube.name}`,
      [FIELDS.SEAT_NAMES]: names,
    });

    for (const seat of document.seats) {
      seat.name = assessColors(seat.mainboard, document.cards).join('');
    }

    await putObject(process.env.DATA_BUCKET, `cardlist/${id}.json`, stripDetails(document.cards));
    await putObject(process.env.DATA_BUCKET, `seats/${id}.json`, {
      seats: document.seats,
      basics: document.basics,
      InitialState: document.InitialState,
    });

    return id;
  },
  batchPut: async (documents) => {
    try {
      const filtered = [];
      const keys = new Set();

      for (const document of documents) {
        if (!keys.has(document.id)) {
          filtered.push(document);
          keys.add(document.id);
        }
      }

      documents = documents.map((document) => dehydrate(document));

      const items = filtered.map((document) => ({
        [FIELDS.ID]: document[FIELDS.ID],
        [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
        [FIELDS.OWNER]: document[FIELDS.OWNER],
        [FIELDS.CUBE_OWNER]: document[FIELDS.CUBE_OWNER],
        [FIELDS.DATE]: document[FIELDS.DATE],
        [FIELDS.TYPE]: document[FIELDS.TYPE],
        [FIELDS.COMPLETE]: document[FIELDS.COMPLETE],
        [FIELDS.NAME]: document[FIELDS.NAME] ? document[FIELDS.NAME].slice(0, 300) : 'Untitled',
        [FIELDS.SEAT_NAMES]: document[FIELDS.SEAT_NAMES],
      }));

      await client.batchPut(items);

      await Promise.all(
        filtered.map(async (document) => {
          await putObject(process.env.DATA_BUCKET, `cardlist/${document.id}.json`, stripDetails(document.cards));
          await putObject(process.env.DATA_BUCKET, `seats/${document.id}.json`, {
            seats: document.seats,
            basics: document.basics,
            InitialState: document.InitialState,
          });
        }),
      );
    } catch (e) {
      console.log(e);
    }
  },
  createTable: async () => client.createTable(),
  convertDeck: (deck, draft, type) => {
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
    let pickorders = [];
    const trashorders = [];

    if (type === TYPES.DRAFT) {
      cards = deck.cards;

      pickorders = draft.seats.map((seat) =>
        seat.pickorder.map((pick) => {
          // if it's a number, we need to convert from draft cards index to deck cards index
          if (typeof pick === 'number') {
            return cards.findIndex((card) => draft.cards[pick].cardID === card.cardID);
          }

          // if it's an object, we need to find the cardID
          if (typeof pick === 'object') {
            return cards.findIndex((card) => pick.cardID === card.cardID);
          }

          return -1;
        }),
      );

      initialState = draft.initial_state.map((seat) =>
        seat.map((pack) => {
          if (pack.cards) {
            return {
              steps: pack.steps,
              cards: pack.cards.map((idx) => cards.findIndex((card) => draft.cards[idx].cardID === card.cardID)),
            };
          }
          if (typeof pack === 'object') {
            return {
              cards: Object.values(pack).map((packCard) => cards.findIndex((card) => packCard.cardID === card.cardID)),
            };
          }
          return {
            cards: pack.map((packCard) => cards.findIndex((card) => packCard.cardID === card.cardID)),
          };
        }),
      );
    } else if (type === TYPES.GRID) {
      pickorders = draft.seats.map((seat) => seat.pickorder);

      cards = draft.cards;
      initialState = draft.initial_state.map((pack) =>
        pack.map((idx) => cards.findIndex((card) => draft.cards[idx].cardID === card.cardID)),
      );
    } else {
      pickorders = deck.seats.map((seat) => seat.pickorder);
      cards = deck.cards;
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
        mainboard: seat.deck,
        sideboard: seat.sideboard,
        pickorder: pickorders[index],
        trashorder: trashorders[index],
        name: assessColors(seat.deck, cards).join(''),
        body: seat.description,
        Bot: seat.bot,
      })),
      InitialState: initialState,
      [FIELDS.TYPE]: type,
      [FIELDS.COMPLETE]: true,
      [FIELDS.NAME]: `${assessColors(deck.seats[0].deck, cards).join('')} ${REVERSE_TYPES[type]} of ${deck.cubename}`,
      [FIELDS.SEAT_NAMES]: deck.seats.map((seat) => seat.name),
    });

    return [doc];
  },
  delete: async (id) => client.delete({ id }),
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
