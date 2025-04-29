import express, { Application } from 'express';
import request from 'supertest';

import Card from '../../src/datatypes/Card';
import CubeType from '../../src/datatypes/Cube';
import { DraftmancerPick } from '../../src/datatypes/Draft';
import { Player, PublishDraftBody } from '../../src/datatypes/Draftmancer';
import type DraftSeatType from '../../src/datatypes/DraftSeat';
import Cube from '../../src/dynamo/models/cube';
import Draft from '../../src/dynamo/models/draft';
import Notification from '../../src/dynamo/models/notification';
import { handler, routes, validatePublishDraftBody } from '../../src/router/routes/api/draftmancer/publish';
import { RequestHandler } from '../../src/types/express';
import { cardFromId } from '../../src/util/carddb';
import { buildBotDeck, formatMainboard, formatSideboard, getPicksFromPlayer } from '../../src/util/draftmancerUtil';
import * as draftutil from '../../src/util/draftutil';
import { createBasicsIds, createCard, createCardDetails, createCube } from '../test-utils/data';
import { call, middleware } from '../test-utils/transport';

jest.mock('../../src/util/draftbots', () => ({
  deckbuild: jest.fn(),
}));

jest.mock('../../src/dynamo/models/cube', () => ({
  getById: jest.fn(),
}));

jest.mock('../../src/dynamo/models/draft', () => ({
  put: jest.fn(),
}));

jest.mock('../../src/dynamo/models/notification', () => ({
  put: jest.fn(),
}));

jest.mock('../../src/util/carddb', () => ({
  cardFromId: jest.fn(),
}));

jest.mock('../../src/dynamo/models/draft', () => ({
  put: jest.fn(),
}));

jest.mock('../../src/util/draftmancerUtil', () => ({
  buildBotDeck: jest.fn(),
  formatMainboard: jest.fn(),
  formatSideboard: jest.fn(),
  getPicksFromPlayer: jest.fn(),
  upsertCardAndGetIndex: jest.fn(),
}));

//Not mocking cardutil because those functions are pretty simple
//Not mocking draftutil.setupPicks as simple

type DraftSeatPicks = Pick<DraftSeatType, 'pickorder' | 'mainboard' | 'sideboard' | 'trashorder'> & {
  draftmancerPicks: DraftmancerPick[];
};

// Helper function to create player data
const createPlayerData = (cardIdPrefix: string, overrides?: Partial<Player>) => ({
  userName: 'test-user',
  isBot: false,
  picks: [
    {
      booster: [
        `cardid-${cardIdPrefix}1234`,
        `cardid-${cardIdPrefix}1253`,
        `cardid-${cardIdPrefix}1123`,
        `cardid-${cardIdPrefix}1475`,
      ],
      picks: [1],
      burn: [],
    },
    {
      booster: [`cardid-${cardIdPrefix}2313`, `cardid-${cardIdPrefix}2211`, `cardid-${cardIdPrefix}2234`],
      picks: [2],
      burn: [],
    },
    {
      booster: [`cardid-${cardIdPrefix}3525`, `cardid-${cardIdPrefix}3526`],
      picks: [0],
      burn: [],
    },
    {
      booster: [`cardid-${cardIdPrefix}4113`],
      picks: [0],
      burn: [],
    },
  ],
  decklist: {
    main: [`cardid-${cardIdPrefix}1253`, `cardid-${cardIdPrefix}2234`, `cardid-${cardIdPrefix}4113`],
    side: [`cardid-${cardIdPrefix}3525`],
    lands: {
      W: 2,
      U: 3,
      B: 5,
      R: 7,
      G: 1,
    },
  },
  ...overrides,
});

const createRequest = (overrides?: Partial<PublishDraftBody>): PublishDraftBody => {
  return {
    cubeID: 'cubeID',
    sessionID: 'sessionID',
    timestamp: 0,
    players: [
      {
        userName: 'drafter-1',
        isBot: false,
        picks: [
          {
            booster: ['7b55019a-df05-4b09-a970-3fde8e892fda'],
            picks: [1, 3, 5, 7, 9],
            burn: [],
          },
          {
            booster: ['56f7614e-5430-4b9b-a3a0-9ab8f9cebf99'],
            picks: [1, 3, 5, 7, 9],
            burn: [],
          },
          {
            booster: ['79c00bbe-6a46-465a-9f41-6048b87422c1'],
            picks: [1, 3, 5, 7, 9],
            burn: [],
          },
        ],
        decklist: {
          main: ['ff9ec6e7-a4ac-46b8-ad6e-697f36de01b8'],
          side: ['e8863cd7-68d7-4996-a194-97d56305fcb9'],
          lands: {
            W: 2,
            U: 3,
            B: 5,
            R: 7,
            G: 10,
          },
        },
      },
    ],
    apiKey: 'api-key',
    ...overrides,
  };
};

const createPlayerDraftPicks = (startingCardId: number) => {
  return [
    {
      booster: [startingCardId, startingCardId + 1, startingCardId + 2, startingCardId + 3],
      pick: 1,
    },
    {
      booster: [startingCardId + 4, startingCardId + 5, startingCardId + 6],
      pick: 2,
    },
    {
      booster: [startingCardId + 7, startingCardId + 8],
      pick: 0,
    },
    {
      booster: [startingCardId + 9],
      pick: 0,
    },
  ];
};

const createDraftSeatPicks = (
  startingCardId: number,
  mainboardCards: Array<{ column: number; row: number; cardIds: number[] }>,
  sideboardCards: Array<{ column: number; row: number; cardIds: number[] }> = [],
): DraftSeatPicks => {
  const mainboard = draftutil.setupPicks(2, 8);
  const sideboard = draftutil.setupPicks(1, 8);

  mainboardCards.forEach(({ column, row, cardIds }) => {
    mainboard[column][row].push(...cardIds);
  });

  sideboardCards.forEach(({ column, row, cardIds }) => {
    sideboard[column][row].push(...cardIds);
  });

  return {
    mainboard,
    sideboard,
    pickorder: [1, 2, 0, 0],
    trashorder: [],
    draftmancerPicks: createPlayerDraftPicks(startingCardId),
  };
};

describe('Publish', () => {
  let app: Application;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    //Need to type as our RequestHandler or Typescript gets angry
    app.post('/api/draftmancer/publish', ...(routes[0].handler as RequestHandler[]));

    process.env.DRAFTMANCER_API_KEY = 'api-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCards: Map<string, Card> = new Map();

  const mockCube = createCube({ id: 'test-cube', basics: createBasicsIds() });

  // Helper function to setup common test dependencies
  const setupTestDependencies = () => {
    const cardDetails = createCardDetails();

    (Cube.getById as jest.Mock).mockResolvedValue(mockCube);

    (cardFromId as jest.Mock).mockImplementation((cardID: string) => {
      if (!mockCards.has(cardID)) {
        const details = createCard({
          cardID: cardID,
        });
        mockCards.set(cardID, details);
      }
      return mockCards.get(cardID);
    });
    (Draft.put as jest.Mock).mockResolvedValue('test-draft-id');

    return { cube: mockCube, cardDetails };
  };

  // Helper function to verify high level draft details
  const verifyDraftCreation = (cube: CubeType) => {
    expect(Draft.put).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Draftmancer Draft',
        cube: cube.id,
        complete: true,
        cubeOwner: cube.owner,
        InitialState: undefined,
        seed: undefined,
        basics: [0, 1, 2, 3, 4],
        type: 'd',
        owner: undefined,
        date: expect.any(Number),
        DraftmancerLog: expect.objectContaining({
          sessionID: 'sessionID',
        }),
      }),
    );
  };

  const validateHumanDraftSeat = (seat: Record<string, any>, seatInfo: DraftSeatPicks) => {
    expect(seat).toEqual(
      expect.objectContaining({
        description: 'This deck was drafted on Draftmancer by human1',
        owner: undefined,
        bot: false,
      }),
    );
    validateCommonDraftSeat(seat, seatInfo);
  };

  const validateBotDraftSeat = (seat: Record<string, any>, seatInfo: DraftSeatPicks) => {
    expect(seat).toEqual(
      expect.objectContaining({
        description: 'This deck was drafted by a bot on Draftmancer',
        owner: undefined,
        bot: true,
      }),
    );
    validateCommonDraftSeat(seat, seatInfo);
  };

  const validateCommonDraftSeat = (seat: Record<string, any>, seatInfo: DraftSeatPicks) => {
    const { pickorder, mainboard, sideboard, trashorder } = seatInfo;
    expect(seat).toEqual(
      expect.objectContaining({
        pickorder,
        mainboard,
        sideboard,
        trashorder,
        name: '',
        owner: undefined,
      }),
    );
  };

  it('should handle human players correctly', async () => {
    const { cube } = setupTestDependencies();

    // Player 1 setup
    const playerOneDraftSeat = createDraftSeatPicks(6, [
      { column: 0, row: 1, cardIds: [9, 8] },
      { column: 0, row: 2, cardIds: [11] },
    ]);

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerOneDraftSeat);
    (formatMainboard as jest.Mock).mockReturnValueOnce(playerOneDraftSeat.mainboard);
    (formatSideboard as jest.Mock).mockReturnValueOnce(playerOneDraftSeat.sideboard);

    // Player 2 setup
    const playerTwoDraftSeat = createDraftSeatPicks(
      16,
      [
        { column: 0, row: 6, cardIds: [17] },
        { column: 0, row: 7, cardIds: [22] },
        { column: 1, row: 0, cardIds: [23] },
        { column: 1, row: 5, cardIds: [25] },
      ],
      [
        { column: 0, row: 0, cardIds: [6] },
        { column: 0, row: 3, cardIds: [17] },
      ],
    );

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat);
    (formatMainboard as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat.mainboard);
    (formatSideboard as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat.sideboard);

    const response = await call(handler)
      .withBody(
        createRequest({
          cubeID: cube.id,
          players: [
            createPlayerData('1', { userName: 'human1', isBot: false }),
            createPlayerData('2', { userName: 'human2', isBot: false }),
          ],
        }),
      )
      .send();

    expect(response.status).toBe(200);

    const putCall = (Draft.put as jest.Mock).mock.calls[0][0];
    expect(putCall.seats.every((seat: any) => seat.bot === false)).toBeTruthy();
    expect(putCall.seats.every((seat: any) => seat.description.includes('drafted on Draftmancer by'))).toBeTruthy();

    expect(putCall.DraftmancerLog.players[0]).toEqual(playerOneDraftSeat.draftmancerPicks);
    expect(putCall.DraftmancerLog.players[1]).toEqual(playerTwoDraftSeat.draftmancerPicks);

    verifyDraftCreation(cube);

    // Verify notification was sent
    expect(Notification.put).toHaveBeenCalledWith(
      expect.objectContaining({
        date: expect.any(Number),
        to: cube.owner.id,
        from: '',
        fromUsername: 'human1',
        url: '/cube/deck/test-draft-id',
        body: `human1 drafted your cube: ${cube.name}`,
      }),
    );
  });

  it('should handle bot players correctly', async () => {
    const { cube } = setupTestDependencies();
    const cubeWithDisabledAlerts = { ...cube, disableAlerts: true };
    (Cube.getById as jest.Mock).mockResolvedValue(cubeWithDisabledAlerts);

    // Player 1 setup
    const playerOneDraftSeat = createDraftSeatPicks(6, [
      { column: 0, row: 1, cardIds: [9, 8] },
      { column: 0, row: 2, cardIds: [11] },
    ]);

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerOneDraftSeat);
    (formatMainboard as jest.Mock).mockReturnValueOnce(playerOneDraftSeat.mainboard);
    (formatSideboard as jest.Mock).mockReturnValueOnce(playerOneDraftSeat.sideboard);

    // Player 2 (bot) setup
    const playerTwoDraftSeat = createDraftSeatPicks(
      16,
      [
        { column: 0, row: 6, cardIds: [17] },
        { column: 0, row: 7, cardIds: [22] },
        { column: 1, row: 0, cardIds: [23] },
        { column: 1, row: 5, cardIds: [25] },
      ],
      [
        { column: 0, row: 0, cardIds: [6] },
        { column: 0, row: 3, cardIds: [17] },
      ],
    );

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat);
    (buildBotDeck as jest.Mock).mockReturnValueOnce({
      mainboard: playerTwoDraftSeat.mainboard,
      sideboard: playerTwoDraftSeat.sideboard,
    });

    const response = await call(handler)
      .withBody(
        createRequest({
          cubeID: cube.id,
          players: [
            createPlayerData('1', { userName: 'human1', isBot: false }),
            createPlayerData('2', { userName: 'bot2', isBot: true }),
          ],
        }),
      )
      .send();

    expect(response.status).toBe(200);

    const putCall = (Draft.put as jest.Mock).mock.calls[0][0];
    validateHumanDraftSeat(putCall.seats[0], playerOneDraftSeat);
    validateBotDraftSeat(putCall.seats[1], playerTwoDraftSeat);

    expect(putCall.DraftmancerLog.players[0]).toEqual(playerOneDraftSeat.draftmancerPicks);
    expect(putCall.DraftmancerLog.players[1]).toEqual(playerTwoDraftSeat.draftmancerPicks);

    verifyDraftCreation(cube);

    expect(Notification.put).not.toHaveBeenCalled();
  });

  it('should draft notification users the first human players name', async () => {
    const { cube } = setupTestDependencies();

    // Player 1 (bot) setup
    const playerOneDraftSeat = createDraftSeatPicks(
      6,
      [
        { column: 0, row: 6, cardIds: [17] },
        { column: 0, row: 7, cardIds: [22] },
        { column: 1, row: 0, cardIds: [23] },
        { column: 1, row: 5, cardIds: [25] },
      ],
      [
        { column: 0, row: 0, cardIds: [6] },
        { column: 0, row: 3, cardIds: [17] },
      ],
    );

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerOneDraftSeat);
    (buildBotDeck as jest.Mock).mockReturnValueOnce({
      mainboard: playerOneDraftSeat.mainboard,
      sideboard: playerOneDraftSeat.sideboard,
    });

    // Player 2 (human) setup
    const playerTwoDraftSeat = createDraftSeatPicks(16, [
      { column: 0, row: 1, cardIds: [9, 8] },
      { column: 0, row: 2, cardIds: [11] },
    ]);

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat);
    (formatMainboard as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat.mainboard);
    (formatSideboard as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat.sideboard);

    const response = await call(handler)
      .withBody(
        createRequest({
          cubeID: cube.id,
          players: [
            createPlayerData('1', { userName: 'bot1', isBot: true }),
            createPlayerData('2', { userName: 'human1', isBot: false }),
          ],
        }),
      )
      .send();

    expect(response.status).toBe(200);

    const putCall = (Draft.put as jest.Mock).mock.calls[0][0];
    validateBotDraftSeat(putCall.seats[0], playerOneDraftSeat);
    validateHumanDraftSeat(putCall.seats[1], playerTwoDraftSeat);

    expect(putCall.DraftmancerLog.players[0]).toEqual(playerOneDraftSeat.draftmancerPicks);
    expect(putCall.DraftmancerLog.players[1]).toEqual(playerTwoDraftSeat.draftmancerPicks);

    verifyDraftCreation(cube);

    // Verify notification was sent with human player name
    expect(Notification.put).toHaveBeenCalledWith(
      expect.objectContaining({
        date: expect.any(Number),
        to: cube.owner.id,
        from: '',
        fromUsername: 'human1',
        url: '/cube/deck/test-draft-id',
        body: `human1 drafted your cube: ${cube.name}`,
      }),
    );
  });

  it('should not send notification when all players are bots', async () => {
    const { cube } = setupTestDependencies();

    // Player 1 (bot) setup
    const playerOneDraftSeat = createDraftSeatPicks(6, [
      { column: 0, row: 6, cardIds: [17] },
      { column: 0, row: 7, cardIds: [22] },
    ]);

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerOneDraftSeat);
    (buildBotDeck as jest.Mock).mockReturnValueOnce({
      mainboard: playerOneDraftSeat.mainboard,
      sideboard: playerOneDraftSeat.sideboard,
    });

    // Player 2 (also bot) setup
    const playerTwoDraftSeat = createDraftSeatPicks(16, [
      { column: 1, row: 0, cardIds: [23] },
      { column: 1, row: 5, cardIds: [25] },
    ]);

    (getPicksFromPlayer as jest.Mock).mockReturnValueOnce(playerTwoDraftSeat);
    (buildBotDeck as jest.Mock).mockReturnValueOnce({
      mainboard: playerTwoDraftSeat.mainboard,
      sideboard: playerTwoDraftSeat.sideboard,
    });

    const response = await call(handler)
      .withBody(
        createRequest({
          cubeID: cube.id,
          players: [
            createPlayerData('1', { userName: 'bot1', isBot: true }),
            createPlayerData('2', { userName: 'bot2', isBot: true }),
          ],
        }),
      )
      .send();

    expect(response.status).toBe(200);

    const putCall = (Draft.put as jest.Mock).mock.calls[0][0];
    validateBotDraftSeat(putCall.seats[0], playerOneDraftSeat);
    validateBotDraftSeat(putCall.seats[1], playerTwoDraftSeat);

    expect(putCall.DraftmancerLog.players[0]).toEqual(playerOneDraftSeat.draftmancerPicks);
    expect(putCall.DraftmancerLog.players[1]).toEqual(playerTwoDraftSeat.draftmancerPicks);

    verifyDraftCreation(cube);

    // Verify no notification was sent since all players were bots
    expect(Notification.put).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const error = new Error('Database error');
    (Cube.getById as jest.Mock).mockRejectedValue(error);

    const response = await request(app).post('/api/draftmancer/publish').send(createRequest());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Error publishing draft',
    });
  });

  it('should handle missing cube gracefully', async () => {
    (Cube.getById as jest.Mock).mockResolvedValue(null);

    const response = await request(app).post('/api/draftmancer/publish').send(createRequest());

    expect(response.status).toBe(500);
  });

  it('requires a valid api key', async () => {
    let response = await request(app)
      .post('/api/draftmancer/publish')
      .send(createRequest({ apiKey: '' }));
    expect(response.status).toBe(400);

    response = await request(app)
      .post('/api/draftmancer/publish')
      .send(createRequest({ apiKey: 'invalid api key' }));
    expect(response.status).toBe(401);
  });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
describe('validatePublishDraftBody', () => {
  const assertPassingValidation = async (body: any) => {
    const res = await middleware(validatePublishDraftBody).withBody(body).send();
    expect(res.nextCalled).toBeTruthy();
  };

  const assertFailingValidation = async (body: any) => {
    const res = await middleware(validatePublishDraftBody).withBody(body).send();
    expect(res.status).toEqual(400);
    expect(res.nextCalled).toBeFalsy();
  };

  const validBody = {
    cubeID: 'test-cube-id',
    sessionID: 'test-session-id',
    timestamp: 1234567890,
    players: [
      {
        userName: 'testUser',
        isBot: false,
        picks: [
          {
            booster: ['123e4567-e89b-12d3-a456-426614174000'],
            picks: [1, 2],
            burn: [0],
          },
        ],
        decklist: {
          main: ['123e4567-e89b-12d3-a456-426614174000'],
          side: ['223e4567-e89b-12d3-a456-426614174000'],
          lands: {
            W: 4,
            U: 4,
            B: 4,
            R: 4,
            G: 4,
          },
        },
      },
    ],
    apiKey: 'test-api-key',
  };

  it('should pass with valid body data', async () => {
    await assertPassingValidation(validBody);
  });

  it('should fail without cubeID', async () => {
    const { cubeID, ...bodyWithoutCubeId } = validBody;
    await assertFailingValidation(bodyWithoutCubeId);
  });

  it('should fail without sessionID', async () => {
    const { sessionID, ...bodyWithoutSessionId } = validBody;
    await assertFailingValidation(bodyWithoutSessionId);
  });

  it('should fail without timestamp', async () => {
    const { timestamp, ...bodyWithoutTimestamp } = validBody;
    await assertFailingValidation(bodyWithoutTimestamp);
  });

  it('should fail without players array', async () => {
    const { players, ...bodyWithoutPlayers } = validBody;
    await assertFailingValidation(bodyWithoutPlayers);
  });

  it('should fail with invalid player data', async () => {
    const invalidBody = {
      ...validBody,
      players: [
        {
          userName: 'testUser',
          // missing isBot
          picks: validBody.players[0].picks,
          decklist: validBody.players[0].decklist,
        },
      ],
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail with invalid picks structure', async () => {
    const invalidBody = {
      ...validBody,
      players: [
        {
          ...validBody.players[0],
          picks: [
            {
              booster: 'not-an-array',
              picks: [1],
              burn: [],
            },
          ],
        },
      ],
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail with invalid decklist structure', async () => {
    const invalidBody = {
      ...validBody,
      players: [
        {
          ...validBody.players[0],
          decklist: {
            main: ['valid-id'],
            side: ['valid-id'],
            lands: {
              W: 4,
              U: 4,
              // missing other colors
            },
          },
        },
      ],
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail with invalid UUID in card lists', async () => {
    const invalidBody = {
      ...validBody,
      players: [
        {
          ...validBody.players[0],
          picks: [
            {
              booster: ['not-a-uuid'],
              picks: [1],
              burn: [],
            },
          ],
        },
      ],
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail without apiKey', async () => {
    const { apiKey, ...bodyWithoutApiKey } = validBody;
    await assertFailingValidation(bodyWithoutApiKey);
  });

  it('should allow multiple players', async () => {
    const bodyWithMultiplePlayers = {
      ...validBody,
      players: [validBody.players[0], { ...validBody.players[0], userName: 'testUser2' }],
    };
    await assertPassingValidation(bodyWithMultiplePlayers);
  });

  it('should validate bot players the same as human players', async () => {
    const bodyWithBot = {
      ...validBody,
      players: [{ ...validBody.players[0], isBot: true }],
    };
    await assertPassingValidation(bodyWithBot);
  });
});
