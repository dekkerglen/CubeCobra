import CubeFn from 'serverutils/cubefn';

import { cubelistHandler } from '../../../src/router/routes/cube/api/cubelist';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
  changelogDao: {
    getById: jest.fn(),
    getNearest: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn((cardID: string) => ({ name: cardID })),
}));

import { changelogDao, cubeDao } from '../../../src/dynamo/daos';

describe('GET /cube/api/cubelist/:id', () => {
  const cube = createCube({ id: 'cube-1' });
  const currentCards = { mainboard: [{ cardID: 'Now' }] };
  const pitCards = { mainboard: [{ cardID: 'Then' }] };

  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue(currentCards);
    (CubeFn.reconstructCubeAtChangelog as jest.Mock).mockResolvedValue(pitCards);
  });

  it('returns the current list with no PIT params', async () => {
    const res = await call(cubelistHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(res.body).toBe('Now');
  });

  it('returns the list at the given changelog', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue({ id: 'cl-1', cube: cube.id, date: 1000 });

    const res = await call(cubelistHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ changelog: 'cl-1' })
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toBe('Then');
    expect(CubeFn.reconstructCubeAtChangelog).toHaveBeenCalledWith(cube.id, 1000, currentCards, changelogDao);
  });

  it('prefers changelog over date when both are supplied', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue({ id: 'cl-1', cube: cube.id, date: 1000 });

    const res = await call(cubelistHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ changelog: 'cl-1', date: '5000' })
      .send();

    expect(res.status).toBe(200);
    expect(changelogDao.getNearest).not.toHaveBeenCalled();
    expect(CubeFn.reconstructCubeAtChangelog).toHaveBeenCalledWith(cube.id, 1000, currentCards, changelogDao);
  });

  it('returns 404 for an unknown changelog', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await call(cubelistHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ changelog: 'missing' })
      .send();

    expect(res.status).toBe(404);
  });

  it('returns 404 for a changelog belonging to another cube', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue({ id: 'cl-2', cube: 'other-cube', date: 1000 });

    const res = await call(cubelistHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ changelog: 'cl-2' })
      .send();

    expect(res.status).toBe(404);
    expect(CubeFn.reconstructCubeAtChangelog).not.toHaveBeenCalled();
  });

  it('still resolves by date', async () => {
    (changelogDao.getNearest as jest.Mock).mockResolvedValue({ id: 'cl-1', cube: cube.id, date: 1000 });

    const res = await call(cubelistHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ date: '1500' })
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toBe('Then');
    expect(changelogDao.getNearest).toHaveBeenCalledWith(cube.id, 1500);
  });
});
