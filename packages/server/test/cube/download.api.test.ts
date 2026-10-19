import { cubecobraHandler } from '../../src/router/routes/cube/download';
import { createCard, createCardDetails, createCube, createCustomCard, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn', () => ({
  isCubeViewable: jest.fn(() => true),
}));

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
}));

import { cubeDao } from '../../src/dynamo/daos';
import { cardFromId } from 'serverutils/carddb';

describe('GET /cube/download/cubecobra/:id', () => {
  const regularDetails = createCardDetails({
    name: 'Grizzly Bears',
    type: 'Creature — Bear',
    color_identity: ['G'],
  });
  const regular = createCard({ cardID: 'bears-id', details: regularDetails });
  const custom = createCustomCard('My Custom');

  beforeEach(() => {
    jest.clearAllMocks();
    // Mirror production: unknown ids (custom cards, vouchers) resolve to the typeless placeholder.
    (cardFromId as jest.Mock).mockImplementation((id: string) =>
      id === 'bears-id' ? regularDetails : createCardDetails({ name: 'Invalid Card', type: '', color_identity: [] }),
    );
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [regular, custom] });
  });

  const namesFor = async (cube: any, query: Record<string, string> = {}) => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    const res = await call(cubecobraHandler)
      .as(createUser())
      .withParams({ id: cube.id })
      .withQuery(query)
      .withFlash(jest.fn())
      .send();
    expect(res.status).toBe(200);
    return res.body.split('\r\n').filter(Boolean);
  };

  it('includes unsorted cards when the cube shows them and no showother param is given', async () => {
    const names = await namesFor(createCube({ id: 'c1', showUnsorted: true }));
    expect(names).toEqual(expect.arrayContaining(['Grizzly Bears', 'My Custom']));
  });

  it('omits unsorted cards when the cube hides them and no showother param is given', async () => {
    const names = await namesFor(createCube({ id: 'c1', showUnsorted: false }));
    expect(names).toContain('Grizzly Bears');
    expect(names).not.toContain('My Custom');
  });

  it('lets an explicit showother param override the cube setting', async () => {
    const forcedOn = await namesFor(createCube({ id: 'c1', showUnsorted: false }), { showother: 'true' });
    expect(forcedOn).toEqual(expect.arrayContaining(['Grizzly Bears', 'My Custom']));

    const forcedOff = await namesFor(createCube({ id: 'c1', showUnsorted: true }), { showother: 'false' });
    expect(forcedOff).not.toContain('My Custom');
  });

  it('applies custom sorts defined on the cube, which require the cube to be resolvable', async () => {
    const cube = createCube({
      id: 'c1',
      showUnsorted: false,
      customSorts: [
        {
          name: 'Bears Only',
          matchFirstOnly: true,
          categories: [{ label: 'Bears', filter: 'type:bear' }],
        },
      ],
    });

    const names = await namesFor(cube, { primary: 'Bears Only' });
    expect(names).toContain('Grizzly Bears');
  });
});
