import { cardFromId, getAllMostReasonable } from 'serverutils/carddb';
import CubeFn from 'serverutils/cubefn';
import { recommendOrThrow } from 'serverutils/ml';

import { addsHandler } from '../../../src/router/routes/cube/api/adds';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getAllMostReasonable: jest.fn(),
}));

jest.mock('serverutils/ml', () => ({
  recommendOrThrow: jest.fn(),
}));

jest.mock('serverutils/cubefn');

import { cubeDao } from '../../../src/dynamo/daos';

describe('POST /cube/api/adds board selection', () => {
  const cube = createCube({ id: 'cube-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({
      mainboard: [{ cardID: 'main-card' }],
      maybeboard: [{ cardID: 'maybe-card' }],
      basics: [{ cardID: 'basic-card' }],
    });
    // Each card ID maps to an oracle of the same name with an "-oracle" suffix.
    (cardFromId as jest.Mock).mockImplementation((id: string) => ({ oracle_id: `${id}-oracle` }));
    (getAllMostReasonable as jest.Mock).mockReturnValue([
      { oracle_id: 'candidate-oracle', scryfall_id: 'candidate', type: 'Creature' },
    ]);
    (recommendOrThrow as jest.Mock).mockResolvedValue({ adds: [], totalAdds: 0 });
  });

  const cubeOraclesSent = () => (recommendOrThrow as jest.Mock).mock.calls[0][0];

  it('uses only the mainboard as the cube when no boards are given', async () => {
    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(200);
    expect(cubeOraclesSent()).toEqual(['main-card-oracle']);
  });

  it('uses every selected board as the cube', async () => {
    const res = await call(addsHandler)
      .as(createUser())
      .withBody({ cubeID: cube.id, filterText: 't:creature', boards: ['mainboard', 'maybeboard'] })
      .send();

    expect(res.status).toBe(200);
    expect(cubeOraclesSent()).toEqual(['main-card-oracle', 'maybe-card-oracle']);
  });

  it('ignores boards the cube does not have', async () => {
    const res = await call(addsHandler)
      .as(createUser())
      .withBody({ cubeID: cube.id, filterText: 't:creature', boards: ['basics', 'sideboard'] })
      .send();

    expect(res.status).toBe(200);
    expect(cubeOraclesSent()).toEqual(['basic-card-oracle']);
  });

  it.each([
    ['not an array', 'maybeboard'],
    ['empty', []],
    ['a non-string', ['mainboard', 5]],
    ['a reserved key', ['__proto__']],
  ])('falls back to the mainboard when boards is %s', async (_label, boards) => {
    const res = await call(addsHandler)
      .as(createUser())
      .withBody({ cubeID: cube.id, filterText: 't:creature', boards })
      .send();

    expect(res.status).toBe(200);
    expect(cubeOraclesSent()).toEqual(['main-card-oracle']);
  });
});
