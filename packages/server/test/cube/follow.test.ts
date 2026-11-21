import { followHandler, unfollowHandler } from '../../src/router/routes/cube';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/siteActivity', () => ({ recordSiteActivity: jest.fn() }));

jest.mock('serverutils/util', () => ({
  ...jest.requireActual('serverutils/util'),
  addNotification: jest.fn(),
}));

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getLike: jest.fn(),
    writeLike: jest.fn(),
    deleteLike: jest.fn(),
    incrementLikeCount: jest.fn(),
    refreshHashRowSortKeys: jest.fn(),
    update: jest.fn(),
  },
  userDao: { incrementLikedCubesCount: jest.fn() },
}));

import { cubeDao } from '../../src/dynamo/daos';

const owner = createUser();
const liker = createUser();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cube likes', () => {
  it('refreshes search sort keys with the incremented like count', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', owner, likeCount: 4 }));
    (cubeDao.getLike as jest.Mock).mockResolvedValue(false);
    (cubeDao.incrementLikeCount as jest.Mock).mockResolvedValue(5);

    await call(followHandler).as(liker).withParams({ id: 'cube-1' }).send();

    expect(cubeDao.incrementLikeCount).toHaveBeenCalledWith('cube-1', 1);
    expect(cubeDao.refreshHashRowSortKeys).toHaveBeenCalledWith(expect.objectContaining({ id: 'cube-1', likeCount: 5 }));
    // A full save would write back every field from the copy read at the start of the request.
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('refreshes search sort keys with the decremented like count', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', owner, likeCount: 4 }));
    (cubeDao.getLike as jest.Mock).mockResolvedValue(true);
    (cubeDao.incrementLikeCount as jest.Mock).mockResolvedValue(3);

    await call(unfollowHandler).as(liker).withParams({ id: 'cube-1' }).send();

    expect(cubeDao.incrementLikeCount).toHaveBeenCalledWith('cube-1', -1);
    expect(cubeDao.refreshHashRowSortKeys).toHaveBeenCalledWith(expect.objectContaining({ id: 'cube-1', likeCount: 3 }));
    expect(cubeDao.update).not.toHaveBeenCalled();
  });
});
