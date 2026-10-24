import CubeFn from 'serverutils/cubefn';

import { cubeBoardsHandler } from '../../../src/router/routes/cube/api/cubeboards';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');

import { cubeDao } from '../../../src/dynamo/daos';

describe('GET /cube/api/cubeboards/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
  });

  // The bug: the add-to-cube modal offered the default boards for every cube, so
  // custom boards were missing and boards the cube didn't have were offered.
  it("returns the cube's own boards, including custom ones", async () => {
    const cube = createCube({ id: 'cube-1' });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({
      mainboard: [{ cardID: 'a' }],
      maybeboard: [],
      sideboard: [{ cardID: 'b' }],
    });

    const res = await call(cubeBoardsHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      boards: [
        { value: 'mainboard', label: 'Mainboard' },
        { value: 'maybeboard', label: 'Maybeboard' },
        { value: 'sideboard', label: 'Sideboard' },
      ],
    });
    expect(cubeDao.getCards).toHaveBeenCalledWith(cube.id, cube, { populate: false });
  });

  it('leaves out non-board keys that addtocube would reject', async () => {
    const cube = createCube({ id: 'cube-1' });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ id: 'cube-1', mainboard: [], version: [] });

    const res = await call(cubeBoardsHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.body.boards).toEqual([{ value: 'mainboard', label: 'Mainboard' }]);
  });

  it('404s for a cube the requester cannot view', async () => {
    const cube = createCube({ id: 'cube-1' });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(cubeBoardsHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(404);
    expect(cubeDao.getCards).not.toHaveBeenCalled();
  });
});
