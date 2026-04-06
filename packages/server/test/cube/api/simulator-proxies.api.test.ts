import CubeFn from 'serverutils/cubefn';

import { simulateallHandler } from '../../../src/router/routes/cube/api/simulateall';
import { simulatedeckbuildHandler } from '../../../src/router/routes/cube/api/simulatedeckbuild';
import { simulateencodeHandler } from '../../../src/router/routes/cube/api/simulateencode';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';
import { batchDeckbuild } from 'serverutils/draftbots';
import { cardFromId } from 'serverutils/carddb';
import { getBasicsFromCube } from 'serverutils/cube';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');
jest.mock('serverutils/draftbots', () => ({
  batchDeckbuild: jest.fn(),
}));
jest.mock('serverutils/cube', () => ({
  getBasicsFromCube: jest.fn(() => []),
}));
jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getReasonableCardByOracle: jest.fn(),
  isOracleBasic: jest.fn(() => false),
}));

import { cubeDao } from '../../../src/dynamo/daos';

describe('simulator proxy authorization', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    (getBasicsFromCube as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('POST /cube/api/simulateall returns 400 when cubeId is missing', async () => {
    const res = await call(simulateallHandler).as(createUser()).withBody({ packs: [[]], pools: [[]] }).send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cube id/i);
  });

  it('POST /cube/api/simulateall returns 403 for non-editors', async () => {
    const user = createUser({ id: 'viewer-1' });
    const cube = createCube({ id: 'cube-1' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(false);

    const res = await call(simulateallHandler)
      .as(user)
      .withBody({ cubeId: cube.id, packs: [['a']], pools: [[]] })
      .send();

    expect(res.status).toBe(403);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('POST /cube/api/simulateall proxies when requester can edit the cube', async () => {
    const user = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner: user });
    const body = { cubeId: cube.id, packs: [['a']], pools: [[]] };

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (global as any).fetch.mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, picks: ['a'] }),
    });

    const res = await call(simulateallHandler).as(user).withBody(body).send();

    expect(res.status).toBe(200);
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/simulateall'),
      expect.objectContaining({ body: JSON.stringify(body) }),
    );
  });

  it('POST /cube/api/simulateencode returns 403 for non-editors', async () => {
    const user = createUser({ id: 'viewer-1' });
    const cube = createCube({ id: 'cube-1' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(false);

    const res = await call(simulateencodeHandler)
      .as(user)
      .withBody({ cubeId: cube.id, pools: [['a']] })
      .send();

    expect(res.status).toBe(403);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('POST /cube/api/simulateencode proxies when requester can edit the cube', async () => {
    const user = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner: user });
    const body = { cubeId: cube.id, pools: [['a']] };

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (global as any).fetch.mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, embeddings: [[1, 2, 3]] }),
    });

    const res = await call(simulateencodeHandler).as(user).withBody(body).send();

    expect(res.status).toBe(200);
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/batchencode'),
      expect.objectContaining({ body: JSON.stringify(body) }),
    );
  });

  it('POST /cube/api/simulatedeckbuild/:id returns 403 for non-editors', async () => {
    const user = createUser({ id: 'viewer-1' });
    const cube = createCube({ id: 'cube-1' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(false);

    const res = await call(simulatedeckbuildHandler)
      .as(user)
      .withParams({ id: cube.id })
      .withBody({ inputs: [['oracle-a']] })
      .send();

    expect(res.status).toBe(403);
  });

  it('POST /cube/api/simulatedeckbuild/:id builds decks for editors', async () => {
    const user = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner: user, basics: ['plains'], basicsBoard: 'Basics' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({});
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (batchDeckbuild as jest.Mock).mockResolvedValue([{ mainboard: ['oracle-a'], sideboard: ['oracle-b'] }]);
    (cardFromId as jest.Mock).mockReturnValue(null);

    const res = await call(simulatedeckbuildHandler)
      .as(user)
      .withParams({ id: cube.id })
      .withBody({ inputs: [['oracle-a', 'oracle-b']] })
      .send();

    expect(res.status).toBe(200);
    expect(batchDeckbuild).toHaveBeenCalledWith([
      expect.objectContaining({
        pool: [{ oracle_id: 'oracle-a' }, { oracle_id: 'oracle-b' }],
      }),
    ]);
    expect(res.body).toEqual({
      success: true,
      results: [{ mainboard: ['oracle-a'], sideboard: ['oracle-b'] }],
      basicCardMeta: {},
    });
  });
});
