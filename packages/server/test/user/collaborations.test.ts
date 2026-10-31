jest.mock('../../src/dynamo/daos', () => ({
  collaboratorIndexDao: {
    getCubeIdsForUser: jest.fn(),
  },
  cubeDao: {
    batchGet: jest.fn(),
  },
  packageDao: {
    countByVoter: jest.fn(),
  },
  patronDao: {
    getById: jest.fn(),
  },
  userDao: {
    getById: jest.fn(),
    getByIdOrUsername: jest.fn(),
    getFollow: jest.fn(),
  },
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));
jest.mock('router/middleware', () => ({
  csrfProtection: jest.fn(),
}));

import { collaboratorIndexDao, cubeDao, packageDao, patronDao, userDao } from '../../src/dynamo/daos';
import { handler as collaborationsHandler } from '../../src/router/routes/user/collaborations';
import { handler as getMoreHandler } from '../../src/router/routes/user/getmorecollaborations';
import { render } from '../../src/serverutils/render';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const owner = createUser({ id: 'owner-1', username: 'owner' });
const stranger = createUser({ id: 'stranger-1', username: 'stranger' });

const collab = (id: string, name: string, visibility: string) =>
  createCube({ id, name, visibility, cardCount: 10, collaborators: [owner.id] });

const publicCollab = collab('collab-public', 'Apex Public', 'pu');
const unlistedCollab = collab('collab-unlisted', 'Bastion Unlisted', 'un');
const privateCollab = collab('collab-private', 'Citadel Private', 'pr');

const props = () => (render as jest.Mock).mock.calls[0][3];
const renderedIds = () => props().cubes.map((c: any) => c.id);

// A run of public cubes long enough to span more than one page.
const manyIds = (count: number, prefix = 'c') => Array.from({ length: count }, (_, i) => `${prefix}${i}`);
const manyCubes = (ids: string[]) => ids.map((id) => collab(id, `Cube ${id}`, 'pu'));

describe('the collaborations tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (userDao.getByIdOrUsername as jest.Mock).mockResolvedValue(owner);
    (userDao.getById as jest.Mock).mockResolvedValue(owner);
    (userDao.getFollow as jest.Mock).mockResolvedValue(false);
    (patronDao.getById as jest.Mock).mockResolvedValue(null);
    (packageDao.countByVoter as jest.Mock).mockResolvedValue(0);
    (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(['collab-public', 'collab-unlisted']);
    (cubeDao.batchGet as jest.Mock).mockResolvedValue([publicCollab, unlistedCollab]);
  });

  it('renders its own page rather than the cubes tab', async () => {
    await call(collaborationsHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

    expect((render as jest.Mock).mock.calls[0][2]).toBe('UserCollaborationsPage');
  });

  describe('visibility', () => {
    it('shows a stranger only public collaborations', async () => {
      await call(collaborationsHandler).as(stranger).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(collaboratorIndexDao.getCubeIdsForUser).toHaveBeenCalledWith('owner-1');
      expect(renderedIds()).toEqual(['collab-public']);
    });

    it('shows an anonymous visitor only public collaborations', async () => {
      await call(collaborationsHandler).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(renderedIds()).toEqual(['collab-public']);
    });

    it('shows the profile owner their own unlisted collaborations', async () => {
      await call(collaborationsHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(renderedIds()).toEqual(['collab-public', 'collab-unlisted']);
    });

    it('shows the profile owner a private cube they collaborate on', async () => {
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(['collab-private']);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue([privateCollab]);

      await call(collaborationsHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(renderedIds()).toEqual(['collab-private']);
    });

    it('hides that private collaboration from a stranger', async () => {
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(['collab-private']);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue([privateCollab]);

      await call(collaborationsHandler).as(stranger).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(renderedIds()).toEqual([]);
    });
  });

  describe('paging', () => {
    it('passes an empty page when the user collaborates on nothing', async () => {
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue([]);

      await call(collaborationsHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(renderedIds()).toEqual([]);
      expect(props().hasMore).toBe(false);
      expect(cubeDao.batchGet).not.toHaveBeenCalled();
    });

    it('reads only the first page of ids and reports there is more', async () => {
      const ids = manyIds(50);
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(ids);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue(manyCubes(ids.slice(0, 36)));

      await call(collaborationsHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(cubeDao.batchGet).toHaveBeenCalledWith(ids.slice(0, 36));
      expect(props().hasMore).toBe(true);
      expect(props().nextOffset).toBe(36);
    });

    it('does not report more when the list fits in one page', async () => {
      const ids = manyIds(36);
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(ids);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue(manyCubes(ids));

      await call(collaborationsHandler).as(owner).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(props().hasMore).toBe(false);
      expect(props().nextOffset).toBe(36);
    });

    it('skips past a page the viewer may see nothing in', async () => {
      // The first 36 ids are all private, so a stranger can see none of them. Returning that empty
      // page while hasMore is true would strand the pager on a page that never fills.
      const hidden = manyIds(36, 'hidden');
      const visible = manyIds(2, 'visible');
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue([...hidden, ...visible]);
      (cubeDao.batchGet as jest.Mock)
        .mockResolvedValueOnce(hidden.map((id) => collab(id, `Cube ${id}`, 'pr')))
        .mockResolvedValueOnce(manyCubes(visible));

      await call(collaborationsHandler).as(stranger).withFlash(jest.fn()).withParams({ id: 'owner-1' }).send();

      expect(cubeDao.batchGet).toHaveBeenCalledTimes(2);
      expect(renderedIds()).toEqual(visible);
      expect(props().hasMore).toBe(false);
    });
  });

  describe('getmorecollaborations', () => {
    it('reads the page starting at the offset it was given', async () => {
      const ids = manyIds(50);
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(ids);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue(manyCubes(ids.slice(36)));

      const res = await call(getMoreHandler).as(owner).withBody({ owner: 'owner-1', offset: 36 }).send();

      expect(cubeDao.batchGet).toHaveBeenCalledWith(ids.slice(36));
      expect(res.body.success).toBe('true');
      expect(res.body.hasMore).toBe(false);
      expect(res.body.cubes.map((c: any) => c.id)).toEqual(ids.slice(36));
    });

    it('treats a missing offset as the first page', async () => {
      const ids = manyIds(50);
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(ids);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue(manyCubes(ids.slice(0, 36)));

      await call(getMoreHandler).as(owner).withBody({ owner: 'owner-1' }).send();

      expect(cubeDao.batchGet).toHaveBeenCalledWith(ids.slice(0, 36));
    });

    it('404s for a user that does not exist', async () => {
      (userDao.getById as jest.Mock).mockResolvedValue(null);

      const res = await call(getMoreHandler).as(owner).withBody({ owner: 'nobody' }).send();

      expect(res.status).toBe(404);
      expect(collaboratorIndexDao.getCubeIdsForUser).not.toHaveBeenCalled();
    });

    it('applies the same visibility rules as the first page', async () => {
      (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue(['collab-private']);
      (cubeDao.batchGet as jest.Mock).mockResolvedValue([privateCollab]);

      const res = await call(getMoreHandler).as(stranger).withBody({ owner: 'owner-1', offset: 0 }).send();

      expect(res.body.cubes).toEqual([]);
    });
  });
});
