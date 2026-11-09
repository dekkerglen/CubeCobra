import { MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
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

describe('POST /cube/api/adds totals', () => {
  const cube = createCube({ id: 'cube-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [{ cardID: 'main-card' }] });
    (cardFromId as jest.Mock).mockImplementation((id: string) => ({ oracle_id: `${id}-oracle` }));
    (getAllMostReasonable as jest.Mock).mockReturnValue([
      { oracle_id: 'oracle-a', scryfall_id: 'card-a', type: 'Creature' },
      { oracle_id: 'oracle-b', scryfall_id: 'card-b', type: 'Creature' },
      { oracle_id: 'oracle-c', scryfall_id: 'card-c', type: 'Creature' },
    ]);
    (recommendOrThrow as jest.Mock).mockResolvedValue({
      adds: [
        { oracle: 'oracle-a', rating: 0.9 },
        { oracle: 'oracle-b', rating: 0.8 },
        { oracle: 'oracle-c', rating: 0.7 },
      ],
      totalAdds: 250,
    });
  });

  it('returns the recommender total alongside the page', async () => {
    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(200);
    expect(res.body.cardIDs).toEqual(['card-a', 'card-b', 'card-c']);
    expect(res.body.totalAdds).toBe(250);
    expect(res.body.hasMoreAdds).toBe(true);
  });

  it('still reports hasMoreAdds false on the last page', async () => {
    const res = await call(addsHandler)
      .as(createUser())
      .withBody({ cubeID: cube.id, filterText: 't:creature', skip: 200, limit: 96 })
      .send();

    expect(res.status).toBe(200);
    expect(res.body.hasMoreAdds).toBe(false);
    expect(res.body.totalAdds).toBe(250);
  });

  it('returns totalAdds 0 when the cube ID is missing', async () => {
    const res = await call(addsHandler).as(createUser()).withBody({ filterText: 't:creature' }).send();

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
  });

  it('returns totalAdds 0 when the cube is not viewable', async () => {
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
  });

  it('returns totalAdds 0 when no filter is given', async () => {
    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: '   ' }).send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
  });

  it('returns totalAdds 0 when the filter cannot be parsed', async () => {
    const res = await call(addsHandler)
      .as(createUser())
      .withBody({ cubeID: cube.id, filterText: 't'.repeat(MAX_SEARCH_FILTER_LENGTH + 1) })
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
  });

  it('returns totalAdds 0 when the filter matches nothing', async () => {
    (getAllMostReasonable as jest.Mock).mockReturnValue([]);

    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
    expect(recommendOrThrow as jest.Mock).not.toHaveBeenCalled();
  });

  it('returns totalAdds 0 when the recommender is unavailable', async () => {
    (recommendOrThrow as jest.Mock).mockRejectedValue(new Error('ml down'));

    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ mlUnavailable: true, cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
  });

  it('returns totalAdds 0 when the request fails unexpectedly', async () => {
    (cubeDao.getById as jest.Mock).mockRejectedValue(new Error('dynamo exploded'));

    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 });
  });
});

describe('POST /cube/api/adds eligibility', () => {
  const cube = createCube({ id: 'cube-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [{ cardID: 'main-card' }] });
    (cardFromId as jest.Mock).mockImplementation((id: string) => ({ oracle_id: `${id}-oracle` }));
    (recommendOrThrow as jest.Mock).mockResolvedValue({ adds: [], totalAdds: 0 });
  });

  const eligibleOraclesSent = () => (recommendOrThrow as jest.Mock).mock.calls[0][1].eligibleOracles;

  it('keeps conspiracies and other special-zone cards the filter matches', async () => {
    (getAllMostReasonable as jest.Mock).mockReturnValue([
      { oracle_id: 'conspiracy-oracle', scryfall_id: 'conspiracy', type: 'Conspiracy' },
      { oracle_id: 'plane-oracle', scryfall_id: 'plane', type: 'Plane — Dominaria' },
      { oracle_id: 'contraption-oracle', scryfall_id: 'contraption', type: 'Artifact — Contraption' },
    ]);

    const res = await call(addsHandler)
      .as(createUser())
      .withBody({ cubeID: cube.id, filterText: 'type:conspiracy' })
      .send();

    expect(res.status).toBe(200);
    expect(eligibleOraclesSent()).toEqual(['conspiracy-oracle', 'plane-oracle', 'contraption-oracle']);
  });

  it('drops basic lands and Mystery Booster playtest cards', async () => {
    (getAllMostReasonable as jest.Mock).mockReturnValue([
      { oracle_id: 'basic-oracle', scryfall_id: 'basic', type: 'Basic Land — Island' },
      { oracle_id: 'playtest-oracle', scryfall_id: 'playtest', type: 'Creature', set: 'CMB1' },
      { oracle_id: 'creature-oracle', scryfall_id: 'creature', type: 'Creature' },
    ]);

    const res = await call(addsHandler).as(createUser()).withBody({ cubeID: cube.id, filterText: 'cmc<5' }).send();

    expect(res.status).toBe(200);
    expect(eligibleOraclesSent()).toEqual(['creature-oracle']);
  });
});
