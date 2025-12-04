import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import createClient from '../util';
import { cardFromId } from '../../serverutils/carddb';
import { getObject, putObject } from '../s3client';
import User from './user';
import Cube from './cube';

interface QueryResult {
  items: any[];
  lastEvaluatedKey?: Record<string, NativeAttributeValue>;
}

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
  DRAFTMANCER_LOG: 'DraftmancerLog',
} as const;

const TYPES = {
  GRID: 'g',
  DRAFT: 'd',
  UPLOAD: 'u',
  SEALED: 's',
} as const;

const REVERSE_TYPES: Record<string, string> = {
  g: 'Grid Draft',
  d: 'Draft',
  u: 'Upload',
  s: 'Sealed',
} as const;

const client = createClient({
  name: 'DRAFT',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.CUBE_OWNER]: 'S',
    [FIELDS.OWNER]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.TYPE]: 'S',
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
    {
      name: 'ByTypeAndDate',
      partitionKey: FIELDS.TYPE,
      sortKey: FIELDS.DATE,
    },
  ],
});

const assessColors = (mainboard: any, cards: any): string[] => {
  const colors: Record<string, number> = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  let count = 0;
  for (const card of mainboard.flat(3)) {
    const details = cardFromId(cards[card].cardID);
    if (!details.type.includes('Land')) {
      count += 1;
      for (const color of details.color_identity) {
        if (colors[color] !== undefined) {
          colors[color] += 1;
        }
      }
    }
  }

  const threshold = 0.1;

  const colorKeysFiltered = Object.keys(colors).filter((color) => (colors[color] ?? 0) / count > threshold);

  if (colorKeysFiltered.length === 0) {
    return ['C'];
  }

  return colorKeysFiltered;
};

const getCards = async (id: string): Promise<any> => {
  try {
    return getObject(process.env.DATA_BUCKET!, `cardlist/${id}.json`);
  } catch {
    return [];
  }
};

const addDetails = (cards: any): any => {
  if (!cards) {
    return cards;
  }

  // if cards is string
  if (typeof cards === 'string') {
    try {
      cards = JSON.parse(cards);
    } catch {
      return [];
    }
  }

  cards.forEach((card: any) => {
    card.details = {
      ...cardFromId(card.cardID),
    };
  });
  return cards;
};

const stripDetails = (cards: any[]): any[] => {
  cards.forEach((card: any) => {
    delete card.details;
  });
  return cards;
};

const getSeats = async (id: string): Promise<any> => {
  try {
    return getObject(process.env.DATA_BUCKET!, `seats/${id}.json`);
  } catch {
    return {};
  }
};

const addS3Fields = async (document: any): Promise<any> => {
  if (!document || !document.id) {
    return document;
  }

  const cards = await getCards(document.id);

  if (!cards) {
    return document;
  }

  const seats = await getSeats(document.id);

  if (!seats) {
    return document;
  }

  return {
    ...document,
    seats: seats.seats,
    basics: seats.basics,
    InitialState: seats.InitialState,
    cards: addDetails(cards),
  };
};

// make sure all card references use the card array
const sanitize = (document: any): any => {
  const { cards } = document;

  const indexify = (card: any): any => {
    // if it's an array
    if (Array.isArray(card)) {
      return card.map((c: any) => indexify(c));
    }

    // if it's already index return it
    if (typeof card === 'number') {
      return card;
    }

    if (typeof card === 'object' && card !== null) {
      const index = cards.findIndex((c: any) => c.cardID === card.cardID);

      if (index === -1) {
        return cards.findIndex((c: any) => c.scryfall_id && c.scryfall_id === card.cardID);
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

const hydrate = async (document: any): Promise<any> => {
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

  document.owner = users.find((user: any) => user.id === document.owner);
  document.cubeOwner = users.find((user: any) => user.id === document.cubeOwner);

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
        seat.owner = users.find((user: any) => user.id === seat.owner);
      }
    }
  }

  return document;
};

const dehydrate = (document: any): any => {
  if (document.owner && document.owner.id) {
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

const batchHydrate = async (documents: any[]): Promise<any[]> => {
  const ids = documents.map((document: any) => [document.owner, document.cubeOwner]).flat();

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

export default {
  getById: async (id: string): Promise<any> => hydrate(await addS3Fields((await client.get(id)).Item)),
  batchGet: async (ids: string[]): Promise<any[]> => {
    const documents = await client.batchGet(ids);
    return batchHydrate(await Promise.all(documents.map((document: any) => addS3Fields(document))));
  },
  getByOwner: async (
    owner: string,
    lastKey?: Record<string, NativeAttributeValue>,
    limit = 200,
  ): Promise<QueryResult> => {
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
      Limit: limit,
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(res.Items ?? []),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  getByCube: async (cubeId: string, lastKey?: Record<string, NativeAttributeValue>): Promise<QueryResult> => {
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
      items: await batchHydrate(res.Items ?? []),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  getByCubeOwner: async (cubeOwner: string, lastKey?: Record<string, NativeAttributeValue>): Promise<QueryResult> => {
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
      items: await batchHydrate(res.Items ?? []),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  queryByTypeAndDate: async (type: string, lastKey?: Record<string, NativeAttributeValue>): Promise<QueryResult> => {
    const res = await client.query({
      IndexName: 'ByTypeAndDate',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': FIELDS.TYPE,
      },
      ExpressionAttributeValues: {
        ':type': type,
      },
      Limit: 100,
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(res.Items ?? []),
      lastEvaluatedKey: res.LastEvaluatedKey,
    };
  },
  put: async (document: any): Promise<string> => {
    const id = document.id || uuidv4();

    const names = document.seats.map((seat: any) => assessColors(seat.mainboard, document.cards).join(''));

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
      [FIELDS.NAME]: `${names[0]} ${(REVERSE_TYPES as any)[document.type]} of ${cube?.name || 'Unknown Cube'}`,
      [FIELDS.SEAT_NAMES]: names,
      [FIELDS.DRAFTMANCER_LOG]: document.DraftmancerLog,
    });

    for (const seat of document.seats) {
      seat.name = assessColors(seat.mainboard, document.cards).join('');
    }

    await putObject(process.env.DATA_BUCKET!, `cardlist/${id}.json`, stripDetails(document.cards));
    await putObject(process.env.DATA_BUCKET!, `seats/${id}.json`, {
      seats: document.seats,
      basics: document.basics,
      InitialState: document.InitialState,
    });

    return id;
  },
  batchPut: async (documents: any[]): Promise<void> => {
    const filtered = [];
    const keys = new Set();

    for (const document of documents) {
      if (!keys.has(document.id)) {
        filtered.push(document);
        keys.add(document.id);
      }
    }

    const items = filtered.map((document: any) => ({
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
      filtered.map(async (document: any) => {
        await putObject(process.env.DATA_BUCKET!, `cardlist/${document.id}.json`, stripDetails(document.cards));
        await putObject(process.env.DATA_BUCKET!, `seats/${document.id}.json`, {
          seats: document.seats,
          basics: document.basics,
          InitialState: document.InitialState,
        });
      }),
    );
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  convertDeck: (deck: any, draft: any, type: string): any[] => {
    let cardCount = 0;
    for (const row of deck.seats[0].deck) {
      for (const col of row) {
        cardCount += col.length;
      }
    }

    if (cardCount === 0) {
      return [];
    }

    let cards: any[] = [];
    let initialState: any = {};
    let pickorders: any[] = [];
    const trashorders: any[] = [];

    if (type === TYPES.DRAFT) {
      cards = deck.cards;

      pickorders = draft.seats.map((seat: any) =>
        seat.pickorder.map((pick: any) => {
          // if it's a number, we need to convert from draft cards index to deck cards index
          if (typeof pick === 'number') {
            // if it's out of bounds, we have to return -1
            if (pick >= draft.cards.length) {
              return -1;
            }
            return cards.findIndex((card: any) => draft.cards[pick].cardID === card.cardID);
          }

          // if it's an object, we need to find the cardID
          if (typeof pick === 'object') {
            return cards.findIndex((card: any) => pick.cardID === card.cardID);
          }

          return -1;
        }),
      );

      initialState = draft.InitialState.map((seat: any) =>
        seat.map((pack: any) => {
          if (pack.cards) {
            return {
              steps: pack.steps,
              cards: pack.cards.map((idx: any) =>
                cards.findIndex((card: any) => draft.cards[idx].cardID === card.cardID),
              ),
            };
          }
          if (typeof pack === 'object') {
            return {
              cards: Object.values(pack).map((packCard: any) =>
                cards.findIndex((card: any) => packCard.cardID === card.cardID),
              ),
            };
          }
          return {
            cards: pack.map((packCard: any) => cards.findIndex((card: any) => packCard.cardID === card.cardID)),
          };
        }),
      );
    } else if (type === TYPES.GRID) {
      pickorders = draft.seats.map((seat: any) => seat.pickorder);

      cards = draft.cards;
      initialState = draft.InitialState.map((pack: any) =>
        pack.map((idx: any) => cards.findIndex((card: any) => draft.cards[idx].cardID === card.cardID)),
      );
    } else {
      pickorders = deck.seats.map((seat: any) => seat.pickorder);
      cards = deck.cards;
    }

    const doc = sanitize({
      [FIELDS.ID]: `${deck.draft || deck._id}`,
      [FIELDS.CUBE_ID]: `${deck.cube}`,
      [FIELDS.CUBE_OWNER]: `${deck.cubeOwner}`,
      [FIELDS.OWNER]: `${deck.owner}`,
      [FIELDS.DATE]: deck.date.valueOf(),
      basics: deck.basics.map((card: any) => parseInt(card, 10)),
      cards,
      seats: deck.seats.map((seat: any, index: number) => ({
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
      [FIELDS.NAME]: `${assessColors(deck.seats[0].deck, cards).join('')} ${(REVERSE_TYPES as any)[type]} of ${deck.cubename}`,
      [FIELDS.SEAT_NAMES]: deck.seats.map((seat: any) => seat.name),
    });

    return [doc];
  },
  delete: async (id: string): Promise<void> => client.delete({ id }),
  scan: async (
    limit?: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items: any[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      Limit: limit || 36,
    });

    return {
      items: result.Items ?? [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  FIELDS,
  TYPES,
};
