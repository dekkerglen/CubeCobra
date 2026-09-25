import CubeFn from 'serverutils/cubefn';

import { cubeCardPoolHandler } from '../../../src/router/routes/cube/api/cubecardpool';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');

// Names come straight from the card id so the fixtures read as themselves.
jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn((cardID: string) => ({ name: cardID })),
}));

// serverutils/cube is deliberately NOT mocked — how getBasicsFromCube resolves the
// basics board is the behaviour under test.

import { cubeDao } from '../../../src/dynamo/daos';

describe('GET /cube/api/cubecardpool/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
  });

  const cards = {
    mainboard: [{ cardID: 'Birds of Paradise' }, { cardID: 'Wrenn and Six' }],
    basics: [{ cardID: 'Plains' }, { cardID: 'Island' }, { cardID: 'Forest' }],
  };

  // The bug: the photo scanner matches OCR against this pool, and a cube that never
  // set basicsBoard explicitly (the common case) returned no basics at all — so a
  // photographed "Forest" could never match in-cube.
  it('includes the Basics board when the cube has no explicit basicsBoard', async () => {
    const cube = createCube({ id: 'cube-1' });
    delete (cube as any).basicsBoard;

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cards);

    const res = await call(cubeCardPoolHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(res.body.basics).toEqual([
      { cardID: 'Plains', name: 'Plains' },
      { cardID: 'Island', name: 'Island' },
      { cardID: 'Forest', name: 'Forest' },
    ]);
    expect(res.body.names).toEqual(expect.arrayContaining(['Birds of Paradise', 'Plains', 'Forest']));
  });

  it('honours an explicit basicsBoard of None', async () => {
    const cube = createCube({ id: 'cube-1', basicsBoard: 'None' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cards);

    const res = await call(cubeCardPoolHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.body.basics).toEqual([]);
    expect(res.body.names).toEqual(['Birds of Paradise', 'Wrenn and Six']);
  });

  it('falls back to the legacy cube.basics array', async () => {
    const cube = createCube({ id: 'cube-1', basics: ['Swamp'] });
    delete (cube as any).basicsBoard;

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: cards.mainboard });

    const res = await call(cubeCardPoolHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.body.basics).toEqual([{ cardID: 'Swamp', name: 'Swamp' }]);
  });
});
