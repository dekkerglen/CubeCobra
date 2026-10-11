import { resolveCubeCards } from 'serverutils/cubeCards';
import CubeFn from 'serverutils/cubefn';

import { cubeJSONHandler } from '../../../src/router/routes/cube/api/cubeJSON';
import { Request, Response } from '../../../src/types/express';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
  },
}));
jest.mock('serverutils/cubefn');
jest.mock('serverutils/cubeCards', () => ({
  resolveCubeCards: jest.fn(),
  parseDateParam: jest.fn(),
}));

import { cubeDao } from '../../../src/dynamo/daos';

describe('Cube JSON public API', () => {
  beforeEach(() => {
    (resolveCubeCards as jest.Mock).mockResolvedValue({
      cards: { mainboard: [], maybeboard: [] },
      changelog: undefined,
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('returns primerTabs in place of description', async () => {
    const primerTabs = [
      { title: 'Primer', content: 'x' },
      { title: 'Español', content: 'y' },
    ];
    const cube = createCube({ primerTabs });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    // The shared mock response has no contentType(); stub it for this handler.
    const handler = (req: Request, res: Response) =>
      cubeJSONHandler(req, Object.assign(res, { contentType: jest.fn().mockReturnThis() }));

    const res = await call(handler).withParams({ id: cube.id }).send();

    expect(res.status).toEqual(200);
    const body = JSON.parse(res.body);
    expect(body.primerTabs).toEqual(primerTabs);
    expect(body).not.toHaveProperty('description');
  });
});
