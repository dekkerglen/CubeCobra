import { finishHandler, reopenHandler } from '../../../src/router/routes/cube/records/edit/finish';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  redirect: jest.fn(),
}));

import { redirect } from 'serverutils/render';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

describe('cube/records/edit/finish', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();
  const record = () => ({
    id: 'rec-1',
    cube: cube.id,
    date: Date.now(),
    players: [{ name: 'Alice' }, { name: 'Bob' }],
    matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 0, 0] }], clock: { durationMs: 1, elapsedMs: 0 } }],
    trophy: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockResolvedValue(record());
  });

  const send = (handler: any, body: object, user = cube.owner) =>
    call(handler).as(user).withFlash(flash).withParams({ id: 'rec-1' }).withBody(body).send();
  const saved = () => (recordDao.update as jest.Mock).mock.calls[0][0];

  it('finishes the event, puts the clocks away and gives the confirmed trophy', async () => {
    await send(finishHandler, { trophy: JSON.stringify(['Alice']) });

    expect(saved().finishedAt).toEqual(expect.any(Number));
    expect(saved().trophy).toEqual(['Alice']);
    expect(saved().matches[0].clock).toBeUndefined();
    expect(saved().matches[0].matches).toHaveLength(1);
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/record/rec-1?tab=standings');
  });

  it('ignores a trophy name that is not a player', async () => {
    await send(finishHandler, { trophy: JSON.stringify(['Alice', 'Zed']) });

    expect(saved().trophy).toEqual(['Alice']);
  });

  it('keeps the trophies as they were when none are sent', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue({ ...record(), trophy: ['Bob'] });
    await send(finishHandler, {});

    expect(saved().trophy).toEqual(['Bob']);
  });

  it('refuses someone who cannot edit the cube', async () => {
    await send(finishHandler, { trophy: '[]' }, createUser());

    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('reopens a finished event', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue({ ...record(), finishedAt: 1 });
    await send(reopenHandler, {});

    expect(saved().finishedAt).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/record/rec-1?tab=matches');
  });
});
