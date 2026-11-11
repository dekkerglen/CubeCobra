import { ensureAuthJson } from 'router/middleware';

import { dropHandler, dropSchema, routes } from '../../../src/router/routes/cube/records/edit/drop';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

describe('cube/records/edit/drop', () => {
  const cube = createCube({ id: 'my-cube' });

  let stored: any;

  beforeEach(() => {
    jest.clearAllMocks();
    stored = {
      id: 'rec-1',
      cube: cube.id,
      date: 1,
      name: 'Friday Draft',
      description: '',
      players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
      matches: [],
      trophy: [],
    };
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockImplementation(async () => structuredClone(stored));
    (recordDao.update as jest.Mock).mockImplementation(async (updated: any) => {
      stored = structuredClone(updated);
    });
  });

  const drop = (body: object, user = cube.owner) =>
    call(dropHandler).as(user).withParams({ id: 'rec-1' }).withBody(body).send();

  it('drops a player and brings them back', async () => {
    const first = await drop({ player: 'Bob', dropped: true });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ success: 'true', dropped: ['Bob'] });

    await drop({ player: 'Carol', dropped: true });
    // Dropping twice is still one entry.
    await drop({ player: 'Bob', dropped: true });
    expect(stored.dropped).toEqual(['Carol', 'Bob']);

    const back = await drop({ player: 'Bob', dropped: false });
    expect(back.body.dropped).toEqual(['Carol']);
  });

  it('refuses a name that is not a player in the record', async () => {
    const res = await drop({ player: 'Mallory', dropped: true });
    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('refuses someone who cannot edit the cube', async () => {
    const res = await drop({ player: 'Bob', dropped: true }, createUser());
    expect(res.status).toBe(403);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('answers JSON to a signed-out request, and validates the body', () => {
    expect(routes[0]!.handler).toContain(ensureAuthJson);
    expect(dropSchema.validate({ player: 'Bob' }).error).toBeDefined();
    expect(dropSchema.validate({ player: 'Bob', dropped: true, extra: 1 }).error).toBeDefined();
  });
});
