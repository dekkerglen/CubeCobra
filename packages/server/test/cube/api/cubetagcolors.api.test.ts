import { cubetagcolorsHandler } from '../../../src/router/routes/cube/api/cubetagcolors';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));
jest.mock('serverutils/cubefn', () => ({
  isCubeViewable: jest.fn(() => true),
  buildTagColors: jest.fn(() => []),
}));

import { cubeDao } from '../../../src/dynamo/daos';

describe('cubetagcolors API', () => {
  beforeEach(() => {
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
  });

  it('showTagColors reflects the cube default, not the user', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ showTagColors: false }));

    const res = await call(cubetagcolorsHandler)
      .as(createUser({ hideTagColors: false } as any))
      .withParams({ id: 'c1' })
      .send();

    expect(res.status).toBe(200);
    expect(res.body.showTagColors).toBe(false);
  });

  it('showTagColors defaults to true for a legacy cube', async () => {
    const { showTagColors: _omit, ...cube } = createCube() as any;
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(cubetagcolorsHandler).withParams({ id: 'c1' }).send();

    expect(res.status).toBe(200);
    expect(res.body.showTagColors).toBe(true);
  });
});
