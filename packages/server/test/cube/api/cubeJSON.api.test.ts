import CubeFn from 'serverutils/cubefn';

import { cubeJSONHandler } from '../../../src/router/routes/cube/api/cubeJSON';
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

import { changelogDao, cubeDao } from '../../../src/dynamo/daos';

describe('GET /cube/api/cubeJSON/:id', () => {
  const cube = createCube({ id: 'cube-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (CubeFn.reconstructCubeAtChangelog as jest.Mock).mockResolvedValue({ mainboard: [] });
  });

  it('returns the cube at the given changelog with changelog metadata', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue({ id: 'cl-1', cube: cube.id, date: 1000 });

    const res = await call(cubeJSONHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ changelog: 'cl-1' })
      .send();

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).changelog).toEqual({ id: 'cl-1', date: 1000 });
  });

  it('returns 404 for an unknown changelog', async () => {
    (changelogDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await call(cubeJSONHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery({ changelog: 'missing' })
      .send();

    expect(res.status).toBe(404);
  });

  it('returns primerTabs in place of description', async () => {
    const primerTabs = [
      { title: 'Primer', content: 'x' },
      { title: 'Español', content: 'y' },
    ];
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: cube.id, primerTabs }));

    const res = await call(cubeJSONHandler).withParams({ id: cube.id }).send();

    expect(res.status).toEqual(200);
    const body = JSON.parse(res.body);
    expect(body.primerTabs).toEqual(primerTabs);
    expect(body).not.toHaveProperty('description');
  });
});
