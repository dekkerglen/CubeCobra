import CubeFn from 'serverutils/cubefn';

import { deleteRunHandler, saveHandler } from '../../../src/router/routes/cube/api/simulatesave';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../../src/dynamo/s3client', () => ({
  getBucketName: jest.fn(() => 'bucket'),
  getObject: jest.fn(),
  putObject: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('serverutils/cubefn');

import { cubeDao } from '../../../src/dynamo/daos';
import { deleteObject, getBucketName, getObject, putObject } from '../../../src/dynamo/s3client';

const makeRunData = () => ({
  cubeId: 'client-cube',
  cubeName: 'Client Name',
  numDrafts: 2,
  numSeats: 8,
  deadCardThreshold: 0.05,
  cardStats: [],
  deadCards: [],
  colorBalance: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  archetypeDistribution: [],
  p1p1Frequency: [],
  convergenceScore: 0.1,
  generatedAt: '2000-01-01T00:00:00.000Z',
  cardMeta: {},
  slimPools: [],
  deckBuilds: [],
  setupData: { cubeId: 'client-cube', initialPacks: [], packSteps: [], numSeats: 8 },
  randomTrashByPool: [],
});

describe('POST /cube/api/simulatesave/:id', () => {
  const now = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    (getBucketName as jest.Mock).mockReturnValue('bucket');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('stores the server timestamp in the saved run and stamps cooldown after save', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', name: 'Server Cube', owner });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (getObject as jest.Mock).mockResolvedValue([]);
    (putObject as jest.Mock).mockResolvedValue(undefined);
    (cubeDao.update as jest.Mock).mockResolvedValue(undefined);

    const res = await call(saveHandler).as(owner).withParams({ id: cube.id }).withBody(makeRunData()).send();

    expect(res.status).toBe(200);
    expect(putObject).toHaveBeenNthCalledWith(
      1,
      'bucket',
      `cube/${cube.id}/draftsimulator/${now}.json`,
      expect.objectContaining({
        cubeId: cube.id,
        cubeName: cube.name,
        generatedAt: new Date(now).toISOString(),
        setupData: makeRunData().setupData,
        randomTrashByPool: makeRunData().randomTrashByPool,
      }),
    );
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: cube.id, lastDraftSimulation: now }),
      { skipTimestampUpdate: true },
    );
  });

  it('does not stamp cooldown when saving the run file fails', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', name: 'Server Cube', owner });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (putObject as jest.Mock).mockRejectedValue(new Error('s3 write failed'));

    const res = await call(saveHandler).as(owner).withParams({ id: cube.id }).withBody(makeRunData()).send();

    expect(res.status).toBe(500);
    expect(cubeDao.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /cube/api/simulatesave/:id/:ts', () => {
  beforeEach(() => {
    (getBucketName as jest.Mock).mockReturnValue('bucket');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('returns 403 when trying to delete a run from the last 24 hours', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner });
    const recentTs = Date.now() - 1000;

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);

    const res = await call(deleteRunHandler).as(owner).withParams({ id: cube.id, ts: String(recentTs) }).send();

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/24 hours/i);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('deletes an older run and returns the updated history payload', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-1', owner });
    const olderTs = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const latestTs = olderTs + 1000;
    const updatedLatestRun = { generatedAt: new Date(latestTs).toISOString(), numDrafts: 2 };

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
    (getObject as jest.Mock)
      .mockResolvedValueOnce([
        { ts: latestTs, generatedAt: new Date(latestTs).toISOString(), numDrafts: 2, numSeats: 8, deadCardCount: 0, convergenceScore: 0 },
        { ts: olderTs, generatedAt: new Date(olderTs).toISOString(), numDrafts: 2, numSeats: 8, deadCardCount: 1, convergenceScore: 0.2 },
      ])
      .mockResolvedValueOnce(updatedLatestRun);
    (putObject as jest.Mock).mockResolvedValue(undefined);
    (deleteObject as jest.Mock).mockResolvedValue(undefined);

    const res = await call(deleteRunHandler).as(owner).withParams({ id: cube.id, ts: String(olderTs) }).send();

    expect(res.status).toBe(200);
    expect(putObject).toHaveBeenCalledWith('bucket', `cube/${cube.id}/draftsimulator/index.json`, [
      { ts: latestTs, generatedAt: new Date(latestTs).toISOString(), numDrafts: 2, numSeats: 8, deadCardCount: 0, convergenceScore: 0 },
    ]);
    expect(deleteObject).toHaveBeenCalledWith('bucket', `cube/${cube.id}/draftsimulator/${olderTs}.json`);
    expect(res.body.latestRunData).toEqual(updatedLatestRun);
  });
});
