import CubeFn from 'serverutils/cubefn';

import { changelogHandler } from '../../../src/router/routes/cube/api/changelog';
import { historyHandler } from '../../../src/router/routes/cube/api/history';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
  },
  changelogDao: {
    getById: jest.fn(),
    getChangelog: jest.fn(),
    queryByCubePage: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');

import { changelogDao, cubeDao } from '../../../src/dynamo/daos';

const cube = createCube({ id: 'cube-1' });

beforeEach(() => {
  jest.clearAllMocks();
  (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
  (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
});

describe('GET /cube/api/history/:id', () => {
  it('lists changelog metadata with a next cursor', async () => {
    (changelogDao.queryByCubePage as jest.Mock).mockResolvedValue({
      items: [{ id: 'cl-2', cube: cube.id, date: 2000, cubeVersion: 3, dateCreated: 2000, dateLastUpdated: 2000 }],
      cursor: 'next',
    });

    const res = await call(historyHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cubeId: cube.id,
      changelogs: [{ id: 'cl-2', date: 2000, cubeVersion: 3 }],
      nextCursor: 'next',
    });
    expect(changelogDao.queryByCubePage).toHaveBeenCalledWith(cube.id, undefined, 50);
  });

  it('passes limit and cursor through, capping limit at 100', async () => {
    (changelogDao.queryByCubePage as jest.Mock).mockResolvedValue({ items: [] });

    const res = await call(historyHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ limit: '500', cursor: 'abc' })
      .send();

    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeUndefined();
    expect(changelogDao.queryByCubePage).toHaveBeenCalledWith(cube.id, 'abc', 100);
  });

  it.each(['0', '-1', 'ten'])('rejects invalid limit %p', async (limit) => {
    const res = await call(historyHandler).as(createUser()).withParams({ id: cube.id }).withQuery({ limit }).send();

    expect(res.status).toBe(400);
  });

  it('rejects an invalid cursor', async () => {
    (changelogDao.queryByCubePage as jest.Mock).mockResolvedValue(undefined);

    const res = await call(historyHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ cursor: 'bad' })
      .send();

    expect(res.status).toBe(400);
  });

  it('returns 404 for a cube the caller cannot view', async () => {
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(historyHandler).withParams({ id: cube.id }).send();

    expect(res.status).toBe(404);
    expect(changelogDao.queryByCubePage).not.toHaveBeenCalled();
  });
});

describe('GET /cube/api/changelog/:id/:changelogId', () => {
  const changes = { mainboard: { adds: [{ cardID: 'a', details: { name: 'Card A' } }] } };

  it('returns the changelog entry with its changes', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue({ id: 'cl-1', cube: cube.id, date: 1000, cubeVersion: 2 });
    (changelogDao.getChangelog as jest.Mock).mockResolvedValue(changes);

    const res = await call(changelogHandler).as(createUser()).withParams({ id: cube.id, changelogId: 'cl-1' }).send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'cl-1', cubeId: cube.id, date: 1000, cubeVersion: 2, changes });
    expect(changelogDao.getChangelog).toHaveBeenCalledWith(cube.id, 'cl-1');
  });

  it('returns 404 for an unknown changelog', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await call(changelogHandler).as(createUser()).withParams({ id: cube.id, changelogId: 'nope' }).send();

    expect(res.status).toBe(404);
  });

  it('returns 404 for a changelog belonging to another cube', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue({ id: 'cl-9', cube: 'other-cube', date: 1000 });

    const res = await call(changelogHandler).as(createUser()).withParams({ id: cube.id, changelogId: 'cl-9' }).send();

    expect(res.status).toBe(404);
    expect(changelogDao.getChangelog).not.toHaveBeenCalled();
  });

  it('returns 404 for a cube the caller cannot view', async () => {
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(changelogHandler).withParams({ id: cube.id, changelogId: 'cl-1' }).send();

    expect(res.status).toBe(404);
    expect(changelogDao.getById).not.toHaveBeenCalled();
  });
});
