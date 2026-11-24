jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    batchGet: jest.fn(),
    queryByOwner: jest.fn(),
    queryCubesPinnedBy: jest.fn(),
  },
  packageDao: {
    countByVoter: jest.fn(),
  },
  patronDao: {
    getById: jest.fn(),
  },
  userDao: {
    getByIdOrUsername: jest.fn(),
    getFollow: jest.fn(),
  },
}));
jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

import { cubeDao, packageDao, patronDao, userDao } from '../../src/dynamo/daos';
import { handler as viewHandler } from '../../src/router/routes/user/view';
import { render } from '../../src/serverutils/render';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const owner = createUser({ id: 'owner-1', username: 'owner' });
const stranger = createUser({ id: 'stranger-1', username: 'stranger' });

const ownedPinned = createCube({ id: 'owned-pinned', owner });
const ownedOther = createCube({ id: 'owned-other', owner });
const pinnedCollab = createCube({ id: 'collab-pinned', owner: stranger, collaborators: [owner.id] });
const byId = new Map([ownedPinned, ownedOther, pinnedCollab].map((cube) => [cube.id, cube]));

const renderedCubes = () => (render as jest.Mock).mock.calls[0][3].cubes;

describe('the cubes tab of a profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (userDao.getByIdOrUsername as jest.Mock).mockResolvedValue(owner);
    (userDao.getFollow as jest.Mock).mockResolvedValue(false);
    (patronDao.getById as jest.Mock).mockResolvedValue(null);
    (packageDao.countByVoter as jest.Mock).mockResolvedValue(0);
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [ownedOther, ownedPinned], lastKey: undefined });
    (cubeDao.queryCubesPinnedBy as jest.Mock).mockResolvedValue({ cubeIds: ['collab-pinned', 'owned-pinned'] });
    (cubeDao.batchGet as jest.Mock).mockImplementation(async (ids: string[]) =>
      ids.map((id) => byId.get(id)).filter(Boolean),
    );
  });

  it('hoists and flags only the pinned cubes the profile owner owns', async () => {
    await call(viewHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

    expect(renderedCubes().map((cube: any) => cube.id)).toEqual(['owned-pinned', 'owned-other']);
    expect(renderedCubes()[0].pinnedByCurrentUser).toBe(true);
  });

  it('a visitor sees no pin flags on a profile', async () => {
    await call(viewHandler).as(stranger).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

    expect(cubeDao.queryCubesPinnedBy).not.toHaveBeenCalled();
    expect(renderedCubes().map((cube: any) => cube.id)).toEqual(['owned-other', 'owned-pinned']);
    expect(renderedCubes().some((cube: any) => cube.pinnedByCurrentUser)).toBe(false);
  });
});
