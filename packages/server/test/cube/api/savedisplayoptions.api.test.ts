import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';
import { bodyValidation } from 'router/middleware';

import {
  DisplayOptionsSchema,
  savedisplayoptionsHandler,
} from '../../../src/router/routes/cube/api/savedisplayoptions';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('serverutils/cubefn', () => ({
  isCubeViewable: jest.fn(),
  isCubeEditable: jest.fn(),
}));

import { cubeDao } from '../../../src/dynamo/daos';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

const owner = createUser({ id: 'owner' });
const flipped = Object.fromEntries(Object.entries(DEFAULT_CUBE_DISPLAY_OPTIONS).map(([k, v]) => [k, !v]));

const validate = (body: any) =>
  call(bodyValidation(DisplayOptionsSchema) as any)
    .withBody(body)
    .send();

describe('savedisplayoptions API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (isCubeViewable as jest.Mock).mockReturnValue(true);
    (isCubeEditable as jest.Mock).mockReturnValue(true);
  });

  it('404 when the cube is not viewable', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ owner }));
    (isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(savedisplayoptionsHandler)
      .as(owner)
      .withParams({ id: 'c1' })
      .withBody({ displayOptions: flipped })
      .send();

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: 'false', message: 'Cube not found' });
  });

  it("403 when the user can't edit the cube", async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ owner }));
    (isCubeEditable as jest.Mock).mockReturnValue(false);

    const res = await call(savedisplayoptionsHandler)
      .as(createUser({ id: 'viewer' }))
      .withParams({ id: 'c1' })
      .withBody({ displayOptions: flipped })
      .send();

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: 'false', message: 'Unauthorized' });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('400 when a key is missing', async () => {
    const { showTagColors: _omit, ...partial } = flipped;
    const res = await validate({ displayOptions: partial });
    expect(res.status).toBe(400);
    expect(res.nextCalled).toBe(false);
  });

  it("400 when a value isn't a boolean", async () => {
    const res = await validate({ displayOptions: { ...flipped, showUnsorted: 'true' } });
    expect(res.status).toBe(400);
    expect(res.nextCalled).toBe(false);
  });

  it('accepts a complete boolean body', async () => {
    const res = await validate({ displayOptions: flipped });
    expect(res.nextCalled).toBe(true);
  });

  it('saves only the seven display fields', async () => {
    const tagColors = [{ tag: 'x', color: 'red' }];
    const cube = createCube({ owner, defaultSorts: ['a', 'b', 'c', 'd'], tagColors });
    const views = cube.views;
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(savedisplayoptionsHandler)
      .as(owner)
      .withParams({ id: 'c1' })
      .withBody({ displayOptions: { ...flipped, name: 'hacked' } })
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: 'true' });
    const saved = (cubeDao.update as jest.Mock).mock.calls[0][0];
    for (const [key, value] of Object.entries(flipped)) {
      expect(saved[key]).toBe(value);
    }
    expect(saved.defaultSorts).toEqual(['a', 'b', 'c', 'd']);
    expect(saved.tagColors).toEqual(tagColors);
    expect(saved.views).toBe(views);
    expect(saved.name).toBe(cube.name);
  });
});
