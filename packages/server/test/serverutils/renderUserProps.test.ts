import User from '@utils/datatypes/User';

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    queryByOwner: jest.fn(),
    queryCubesPinnedBy: jest.fn(),
    batchGet: jest.fn(),
  },
  collaboratorIndexDao: {
    getCubeIdsForUser: jest.fn(),
  },
  notificationDao: {
    getByToAndStatus: jest.fn(),
  },
  patronDao: {
    getById: jest.fn(),
  },
}));

import { collaboratorIndexDao, cubeDao, notificationDao, patronDao } from '../../src/dynamo/daos';
import { render } from '../../src/serverutils/render';
import { Response } from '../../src/types/express';
import { createCube, createCubeImage, createUser } from '../test-utils/data';
import { createMockRequest, createMockResponse } from '../test-utils/transport';

const ART_CROP = 'https://cards.scryfall.io/art_crop/x.jpg';

const ownedCubes = [
  createCube({ id: 'owned-1', shortId: 'owned', name: 'Owned Cube', image: createCubeImage({ uri: ART_CROP }) }),
  createCube({ id: 'owned-2', shortId: 'imageless', name: 'Imageless Cube', image: undefined }),
];
const collaboratingCube = createCube({
  id: 'collab-1',
  shortId: 'collab',
  name: 'Collaborating Cube',
  image: createCubeImage({ uri: ART_CROP }),
});

/**
 * `render` mutates the `reactProps` object it is handed and then serializes that same object
 * into the page, so reading it back after the render settles observes exactly what ships to the
 * client -- without having to eval the serialized payload. The work happens in an un-awaited
 * async callback, so we wait on `res.render` being reached rather than on `render` returning.
 */
const renderUserProps = async (user: User): Promise<any> => {
  const reactProps: Record<string, any> = {};
  const req = createMockRequest({ user });
  const res = createMockResponse({}) as unknown as Response;
  const rendered = new Promise<void>((resolve) => {
    res.render = jest.fn(() => resolve()) as any;
  });
  res.setHeader = jest.fn() as any;
  res.vary = jest.fn() as any;

  render(req, res, 'HomePage', reactProps);
  await rendered;

  return reactProps.user;
};

describe('the user payload rendered into every page', () => {
  let userProps: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: ownedCubes, lastKey: undefined });
    (cubeDao.queryCubesPinnedBy as jest.Mock).mockResolvedValue({ cubeIds: [] });
    (cubeDao.batchGet as jest.Mock).mockResolvedValue([collaboratingCube]);
    (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue([collaboratingCube.id]);
    (notificationDao.getByToAndStatus as jest.Mock).mockResolvedValue({ items: [] });
    (patronDao.getById as jest.Mock).mockResolvedValue(undefined);

    userProps = await renderUserProps(createUser({ id: 'viewer-1', followerCount: 7, followingCount: 3 }));
  });

  it('forwards the follower counts already on the user record', async () => {
    expect(userProps.followerCount).toBe(7);
    expect(userProps.followingCount).toBe(3);
  });

  it('carries each cube image uri through the trimmed payload', async () => {
    expect(userProps.cubes[0].imageUri).toBe(ART_CROP);
  });

  it('trims collaborating cubes to the same shape', async () => {
    expect(Object.keys(userProps.collaboratingCubes[0]).sort()).toEqual(['id', 'imageUri', 'name', 'shortId']);
  });

  it('omits imageUri rather than throwing when a cube has no resolved image', async () => {
    expect(userProps.cubes[1].imageUri).toBeUndefined();
  });
});

describe('pinned cubes in the user payload', () => {
  const viewer = createUser({ id: 'viewer-1' });
  const stranger = createUser({ id: 'stranger-1' });
  const pinnedCollab = createCube({
    id: 'collab-1',
    shortId: 'collab',
    name: 'Collaborating Cube',
    owner: stranger,
    collaborators: [viewer.id],
  });
  const lostCube = createCube({ id: 'lost-1', name: 'Lost Cube', owner: stranger, visibility: 'pr' });
  const byId = new Map([pinnedCollab, lostCube, ...ownedCubes].map((cube) => [cube.id, cube]));

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: ownedCubes, lastKey: undefined });
    (cubeDao.queryCubesPinnedBy as jest.Mock).mockResolvedValue({ cubeIds: [lostCube.id, pinnedCollab.id] });
    (cubeDao.batchGet as jest.Mock).mockImplementation(async (ids: string[]) =>
      ids.map((id) => byId.get(id)).filter(Boolean),
    );
    (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue([pinnedCollab.id]);
    (notificationDao.getByToAndStatus as jest.Mock).mockResolvedValue({ items: [] });
    (patronDao.getById as jest.Mock).mockResolvedValue(undefined);
  });

  it('puts pinned collaborations in the pinned group, flagged', async () => {
    const userProps = await renderUserProps(viewer);

    expect(userProps.cubes.map((cube: any) => cube.id)).toEqual(['collab-1', 'owned-1', 'owned-2']);
    expect(userProps.cubes[0].pinnedByCurrentUser).toBe(true);
    expect(userProps.cubes[1].pinnedByCurrentUser).toBeUndefined();
  });

  it('leaves pinned collaborations out of collaboratingCubes', async () => {
    const userProps = await renderUserProps(viewer);

    expect(userProps.collaboratingCubes).toEqual([]);
  });

  it('drops pinned cubes the user can no longer view', async () => {
    const userProps = await renderUserProps(viewer);

    expect(userProps.cubes.map((cube: any) => cube.id)).not.toContain('lost-1');
  });

  it('looks up the pins once per render', async () => {
    await renderUserProps(viewer);

    expect(cubeDao.queryCubesPinnedBy).toHaveBeenCalledTimes(1);
  });
});
