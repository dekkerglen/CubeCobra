import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { cardFromId, getOracleForMl } from 'serverutils/carddb';
import { getBasicsFromCube } from 'serverutils/cube';
import CubeFn from 'serverutils/cubefn';

import { simulatesetupHandler } from '../../../src/router/routes/cube/api/simulatesetup';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');
jest.mock('@utils/drafting/createdraft', () => ({
  createDraft: jest.fn(),
  getDraftFormat: jest.fn(),
}));
jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getOracleForMl: jest.fn((oracle: string) => oracle),
}));
jest.mock('serverutils/cube', () => ({
  getBasicsFromCube: jest.fn(() => []),
}));

import { cubeDao } from '../../../src/dynamo/daos';

describe('POST /cube/api/simulatesetup/:id', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (getBasicsFromCube as jest.Mock).mockReturnValue([]);
    (getOracleForMl as jest.Mock).mockImplementation((oracle: string) => oracle);
  });

  it('allows a viewer who can see the cube to request setup data', async () => {
    const viewer = createUser({ id: 'viewer-1' });
    const cube = createCube({ id: 'cube-1' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({});
    (getDraftFormat as jest.Mock).mockReturnValue({});
    (createDraft as jest.Mock).mockReturnValue({
      InitialState: [
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [0] }],
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [1] }],
      ],
      cards: [
        { details: { oracle_id: 'oracle-a', name: 'Card A', color_identity: [], type: 'Instant' } },
        { details: { oracle_id: 'oracle-b', name: 'Card B', color_identity: [], type: 'Sorcery' } },
      ],
    });

    const res = await call(simulatesetupHandler)
      .as(viewer)
      .withParams({ id: cube.id })
      .withBody({ numDrafts: 1, numSeats: 2 })
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cubeDao.getCards).toHaveBeenCalled();
  });

  it('returns setup data on success and does not stamp cooldown yet', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner, lastDraftSimulation: undefined });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({});
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (getDraftFormat as jest.Mock).mockReturnValue({});
    (createDraft as jest.Mock).mockReturnValue({
      InitialState: [
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [0] }],
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [1] }],
      ],
      cards: [
        {
          details: {
            oracle_id: 'oracle-a',
            name: 'Card A',
            image_normal: '',
            image_small: '',
            color_identity: ['U'],
            elo: 1210,
            cmc: 2,
            type: 'Instant',
          },
        },
        {
          details: {
            oracle_id: 'oracle-b',
            name: 'Card B',
            image_normal: '',
            image_small: '',
            color_identity: ['R'],
            elo: 1190,
            cmc: 3,
            type: 'Sorcery',
          },
        },
      ],
    });

    const res = await call(simulatesetupHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ numDrafts: 1, numSeats: 2 })
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cubeId).toBe(cube.id);
    expect(res.body.numSeats).toBe(2);
    expect(res.body.initialPacks).toHaveLength(1);
    expect(res.body.packSteps).toEqual([[{ action: 'pick', amount: 1 }]]);
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('returns 400 when setup body is invalid', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner, lastDraftSimulation: undefined });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);

    const res = await call(simulatesetupHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ numDrafts: 0, numSeats: 2 })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/numDrafts/i);
  });

  it('returns 400 when numDrafts exceeds the supported cap', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner, lastDraftSimulation: undefined });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(simulatesetupHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ numDrafts: 1001, numSeats: 2 })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/numDrafts/i);
  });

  it('includes basics and omits simToken from the setup response', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner, basics: ['plains-id'], basicsBoard: 'Basics' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({});
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (getDraftFormat as jest.Mock).mockReturnValue({});
    (createDraft as jest.Mock).mockReturnValue({
      InitialState: [
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [0] }],
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [1] }],
      ],
      cards: [
        {
          details: {
            oracle_id: 'oracle-a',
            name: 'Card A',
            image_normal: '',
            image_small: '',
            color_identity: ['U'],
            elo: 1210,
            cmc: 2,
            type: 'Instant',
          },
        },
        {
          details: {
            oracle_id: 'oracle-b',
            name: 'Card B',
            image_normal: '',
            image_small: '',
            color_identity: ['R'],
            elo: 1190,
            cmc: 3,
            type: 'Sorcery',
          },
        },
      ],
    });
    (getBasicsFromCube as jest.Mock).mockReturnValue(['plains-id']);
    (cardFromId as jest.Mock).mockReturnValue({
      oracle_id: 'plains-oracle',
      name: 'Plains',
      image_normal: 'plains.png',
      color_identity: ['W'],
      produced_mana: ['W'],
      type: 'Basic Land',
    });

    const res = await call(simulatesetupHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ numDrafts: 1, numSeats: 2 })
      .send();

    expect(res.status).toBe(200);
    expect(res.body.simToken).toBeUndefined();
    expect(res.body.basics).toEqual([
      expect.objectContaining({
        oracleId: 'plains-oracle',
        name: 'Plains',
        producedMana: ['W'],
      }),
    ]);
  });

  it('uses the requested custom format id when provided', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({
      id: 'cube-1',
      owner,
      defaultFormat: 0,
      formats: [{ title: 'Two Packs', packs: [], multiples: false, defaultSeats: 8 }],
    });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({});
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (getDraftFormat as jest.Mock).mockReturnValue({});
    (createDraft as jest.Mock).mockReturnValue({
      InitialState: [
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [0] }],
        [{ steps: [{ action: 'pick', amount: 1 }], cards: [1] }],
      ],
      cards: [
        { details: { oracle_id: 'oracle-a', name: 'Card A', color_identity: [], type: 'Instant' } },
        { details: { oracle_id: 'oracle-b', name: 'Card B', color_identity: [], type: 'Sorcery' } },
      ],
    });

    const res = await call(simulatesetupHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ numDrafts: 1, numSeats: 2, formatId: 0 })
      .send();

    expect(res.status).toBe(200);
    expect(getDraftFormat).toHaveBeenCalledWith(expect.objectContaining({ id: 0, players: 2 }), cube);
  });
});
