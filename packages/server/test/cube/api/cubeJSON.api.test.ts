import CubeFn from 'serverutils/cubefn';

import { cubeJSONHandler } from '../../../src/router/routes/cube/api/cubeJSON';
import { createCard, createCardDetails, createCube, createCustomCard, createUser } from '../../test-utils/data';
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

describe('GET /cube/api/cubeJSON/:id returns every card', () => {
  // A custom card with no type line lands outside every Types-Multicolor bucket. The API is a data
  // export, so it must still return it regardless of the cube's "show unsorted" display setting.
  const typelessCustom = createCustomCard('My Custom', { details: undefined });
  const regular = createCard({
    details: createCardDetails({ name: 'Grizzly Bears', type: 'Creature — Bear', color_identity: ['G'] }),
  });

  const exportedNames = async (showUnsorted: boolean, cards = [typelessCustom, regular], cubeOverrides = {}) => {
    const cube = createCube({ id: 'cube-1', showUnsorted, ...cubeOverrides });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: cards });

    const res = await call(cubeJSONHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    return JSON.parse(res.body).cards.mainboard.map((c: any) => c.custom_name ?? c.details?.name);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([true, false])('includes unsorted cards at the end when showUnsorted is %s', async (showUnsorted) => {
    await expect(exportedNames(showUnsorted)).resolves.toEqual(['Grizzly Bears', 'My Custom']);
  });

  it('lists a card once even when the default sort puts it in several groups', async () => {
    const tagged = createCard({
      tags: ['a', 'b'],
      details: createCardDetails({ name: 'Tagged', type: 'Instant', color_identity: ['R'] }),
    });

    const names = await exportedNames(false, [tagged], {
      defaultSorts: ['Tags', 'Types-Multicolor', 'Mana Value', 'Alphabetical'],
    });
    expect(names).toEqual(['Tagged']);
  });
});
