import { ensureAuthJson } from 'router/middleware';

import {
  clockActionHandler,
  clockActionSchema,
  getClocksHandler,
  routes,
} from '../../../src/router/routes/cube/records/clock';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

const MINUTE = 60_000;

describe('cube/records/clock', () => {
  const cube = createCube({ id: 'my-cube' });

  let stored: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: 1_000_000 });
    stored = {
      id: 'rec-1',
      cube: cube.id,
      date: 1,
      name: 'Friday Draft',
      description: '',
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      matches: [
        { matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 0, 0] }] },
        { matches: [{ p1: 'Alice', p2: 'Bob', results: [0, 0, 0] }] },
      ],
      trophy: [],
    };
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockImplementation(async () => structuredClone(stored));
    (recordDao.update as jest.Mock).mockImplementation(async (updated: any) => {
      stored = structuredClone(updated);
    });
  });

  afterEach(() => jest.useRealTimers());

  const act = (body: object, user = cube.owner) =>
    call(clockActionHandler).as(user).withParams({ id: 'rec-1' }).withBody(body).send();

  it('starts, pauses and extends a round clock on that round only', async () => {
    const started = await act({ roundIndex: 1, action: 'start', minutes: 45 });
    expect(started.status).toBe(200);
    expect(started.body).toEqual({
      success: 'true',
      clock: { durationMs: 45 * MINUTE, elapsedMs: 0, startedAt: 1_000_000 },
      now: 1_000_000,
    });

    jest.setSystemTime(1_000_000 + 10 * MINUTE);
    await act({ roundIndex: 1, action: 'pause' });
    await act({ roundIndex: 1, action: 'add', minutes: 5 });

    expect(stored.matches[1].clock).toEqual({ durationMs: 50 * MINUTE, elapsedMs: 10 * MINUTE });
    expect(stored.matches[1].matches).toEqual([{ p1: 'Alice', p2: 'Bob', results: [0, 0, 0] }]);
    expect(stored.matches[0].clock).toBeUndefined();
  });

  it('removes the clock on clear', async () => {
    await act({ roundIndex: 0, action: 'start' });
    const res = await act({ roundIndex: 0, action: 'clear' });

    expect(res.body.clock).toBeNull();
    expect(stored.matches[0]).not.toHaveProperty('clock');
  });

  it('refuses a round that does not exist', async () => {
    const res = await act({ roundIndex: 2, action: 'start' });
    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('refuses an action from a page that missed a round being added or removed', async () => {
    // The page saw one round and meant its clock; round 2 is the latest now.
    const res = await act({ roundIndex: 0, action: 'start', expectedRounds: 1 });
    expect(res.status).toBe(409);
    expect(res.body.rounds).toHaveLength(2);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('refuses someone who cannot edit the cube', async () => {
    const res = await act({ roundIndex: 0, action: 'start' }, createUser());
    expect(res.status).toBe(403);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('answers JSON to a signed-out request, and rejects an unknown action', () => {
    const post = routes.find((route) => route.method === 'post')!;
    expect(post.handler).toContain(ensureAuthJson);
    expect(clockActionSchema.validate({ roundIndex: 0, action: 'reset' }).error).toBeDefined();
  });

  it('lets anyone who can see the record read its clocks, with the server time', async () => {
    stored.matches[1].clock = { durationMs: MINUTE, elapsedMs: 0, startedAt: 5 };
    const res = await call(getClocksHandler).as(createUser()).withParams({ id: 'rec-1' }).send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      clocks: [null, { durationMs: MINUTE, elapsedMs: 0, startedAt: 5 }],
      now: 1_000_000,
    });
  });
});
