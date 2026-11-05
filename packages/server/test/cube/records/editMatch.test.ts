import { bodyValidation, ensureAuthJson } from 'router/middleware';

import {
  addMatchHandler,
  removeMatchHandler,
  routes,
  setMatchHandler,
  setMatchSchema,
} from '../../../src/router/routes/cube/records/edit/match';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

describe('cube/records/edit/match', () => {
  const cube = createCube({ id: 'my-cube' });

  const baseRecord = () => ({
    id: 'rec-1',
    cube: cube.id,
    date: 1,
    name: 'Friday Draft',
    description: '',
    players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' }],
    matches: [
      {
        matches: [
          { p1: 'Alice', p2: 'Bob', results: [2, 1, 0] },
          { p1: 'Carol', p2: 'Dave', results: [1, 2, 0] },
        ],
      },
      {
        matches: [{ p1: 'Alice', p2: 'Carol', results: [0, 0, 0] }],
      },
    ],
    trophy: [],
    dateCreated: 1,
    dateLastUpdated: 1,
  });

  // A tiny fake backing store: getById returns whatever update last wrote, so a second
  // request in the same test re-reads what the first one actually persisted, the same as
  // two devices hitting real DynamoDB one after another would.
  let stored: any;

  beforeEach(() => {
    jest.clearAllMocks();
    stored = baseRecord();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockImplementation(async () => structuredClone(stored));
    (recordDao.update as jest.Mock).mockImplementation(async (updated: any) => {
      stored = structuredClone(updated);
    });
  });

  const setMatch = (roundIndex: number, matchIndex: number, match: unknown, user = cube.owner) =>
    call(setMatchHandler).as(user).withParams({ id: 'rec-1' }).withBody({ roundIndex, matchIndex, match }).send();

  const addMatch = (roundIndex: number, user = cube.owner) =>
    call(addMatchHandler).as(user).withParams({ id: 'rec-1' }).withBody({ roundIndex }).send();

  const removeMatch = (roundIndex: number, matchIndex: number, user = cube.owner) =>
    call(removeMatchHandler).as(user).withParams({ id: 'rec-1' }).withBody({ roundIndex, matchIndex }).send();

  it('sets one match without touching its neighbours in the round', async () => {
    const res = await setMatch(0, 1, { p1: 'Carol', p2: 'Dave', results: [2, 2, 1] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: 'true', round: stored.matches[0] });
    expect(stored.matches[0].matches[0]).toEqual({ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] });
    expect(stored.matches[0].matches[1]).toEqual({ p1: 'Carol', p2: 'Dave', results: [2, 2, 1] });
  });

  it('sets one match without touching other rounds', async () => {
    await setMatch(0, 0, { p1: 'Alice', p2: 'Bob', results: [2, 0, 0] });

    expect(stored.matches[1]).toEqual({ matches: [{ p1: 'Alice', p2: 'Carol', results: [0, 0, 0] }] });
  });

  it('appends an empty match to a round', async () => {
    const res = await addMatch(1);

    expect(res.status).toBe(200);
    expect(stored.matches[1].matches).toEqual([
      { p1: 'Alice', p2: 'Carol', results: [0, 0, 0] },
      { p1: 'Unknown Opponent', p2: 'Unknown Opponent', results: [0, 0, 0] },
    ]);
    expect(res.body).toEqual({ success: 'true', round: stored.matches[1] });
  });

  it('removes one match, leaving the rest in order', async () => {
    const res = await removeMatch(0, 0);

    expect(res.status).toBe(200);
    expect(stored.matches[0].matches).toEqual([{ p1: 'Carol', p2: 'Dave', results: [1, 2, 0] }]);
    expect(res.body).toEqual({ success: 'true', round: stored.matches[0] });
  });

  it('rejects a round index outside the record', async () => {
    const res = await setMatch(5, 0, { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] });

    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a match index outside the round', async () => {
    const res = await setMatch(0, 5, { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] });

    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  // These are JSON endpoints hit by fetch from the live match console, not HTML forms, so an
  // unauthenticated request must get a clean 403 JSON body rather than ensureAuth's 302 redirect
  // to /user/login, which a fetch caller can't usefully follow.
  it('guards the set-match route with the JSON auth guard, not the HTML redirect guard', () => {
    const route = routes.find((r) => r.path === '/set/:id');

    expect(route?.handler).toContain(ensureAuthJson);
  });

  it('rejects a user who cannot edit the cube', async () => {
    const res = await setMatch(0, 0, { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] }, createUser());

    expect(res.status).toBe(403);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a negative or fractional result count', async () => {
    const validate = (results: unknown) =>
      call(bodyValidation(setMatchSchema) as any)
        .withBody({ roundIndex: 0, matchIndex: 0, match: { p1: 'Alice', p2: 'Bob', results } })
        .send();

    expect((await validate([-1, 0, 0])).status).toBe(400);
    expect((await validate([1.5, 0, 0])).status).toBe(400);
    expect((await validate([1, 0, 0])).nextCalled).toBe(true);
  });

  // Unlike the old whole-round-replacement flow, which overwrote the full round array with
  // whatever the client happened to be holding (silently reverting another device's result
  // that landed first), this endpoint only ever carries the one match being reported, and
  // re-reads the record fresh on each request, so two results reported from separate requests
  // both land even when the second request's read happens only once the first request's write
  // has landed.
  it('lands two results reported into the same round from separate requests', async () => {
    await setMatch(0, 0, { p1: 'Alice', p2: 'Bob', results: [2, 0, 0] });
    await setMatch(0, 1, { p1: 'Carol', p2: 'Dave', results: [0, 2, 0] });

    expect(stored.matches[0].matches).toEqual([
      { p1: 'Alice', p2: 'Bob', results: [2, 0, 0] },
      { p1: 'Carol', p2: 'Dave', results: [0, 2, 0] },
    ]);
  });
});
