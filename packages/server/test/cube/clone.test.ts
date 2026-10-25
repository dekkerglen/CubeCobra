import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';
import * as render from 'serverutils/render';

import { cubeDao } from '../../src/dynamo/daos';
import { cloneHandler } from '../../src/router/routes/cube/clone';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos');
jest.mock('serverutils/cubefn', () => ({
  isCubeViewable: jest.fn().mockReturnValue(true),
}));
jest.mock('serverutils/imageutil', () => ({
  getImageData: jest.fn().mockReturnValue({}),
}));
jest.mock('serverutils/util', () => ({
  addNotification: jest.fn(),
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

describe('Clone Cube Handler', () => {
  const flashMock = jest.fn();
  const user = createUser();
  const source = createCube({
    primerTabs: [
      { title: 'Primer', content: 'body' },
      { title: 'Español', content: 'cuerpo' },
    ],
  });

  beforeEach(() => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(source);
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('prepends the clone notice to the first primer tab only', async () => {
    await call(cloneHandler).as(user).withFlash(flashMock).withParams({ id: source.id }).send();

    expect(cubeDao.putNewCube).toHaveBeenCalledTimes(1);
    const [clone] = (cubeDao.putNewCube as jest.Mock).mock.calls[0];
    expect(clone.primerTabs).toEqual([
      { title: 'Primer', content: `Cloned from [${source.name}](/c/${source.id})\n\nbody` },
      { title: 'Español', content: 'cuerpo' },
    ]);
    expect(render.redirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      `/cube/about/${clone.id}?view=primer`,
    );
  });

  it('copies every display option from the source cube', async () => {
    const flipped = Object.fromEntries(Object.entries(DEFAULT_CUBE_DISPLAY_OPTIONS).map(([k, v]) => [k, !v]));
    (cubeDao.getById as jest.Mock).mockResolvedValue({ ...source, ...flipped });

    await call(cloneHandler).as(user).withFlash(flashMock).withParams({ id: source.id }).send();

    const [clone] = (cubeDao.putNewCube as jest.Mock).mock.calls[0];
    for (const [key, value] of Object.entries(flipped)) {
      expect(clone[key]).toBe(value);
    }
  });

  it('copies the hero theme from the source cube', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue({ ...source, heroTheme: 'blue' });

    await call(cloneHandler).as(user).withFlash(flashMock).withParams({ id: source.id }).send();

    const [clone] = (cubeDao.putNewCube as jest.Mock).mock.calls[0];
    expect(clone.heroTheme).toBe('blue');
  });
});
