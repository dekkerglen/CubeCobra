import CubeFn from 'serverutils/cubefn';

import {
  acceptInviteHandler,
  addCollaboratorHandler,
  cancelInviteHandler,
  declineInviteHandler,
  listCollaboratorsHandler,
  removeCollaboratorHandler,
} from '../../../src/router/routes/cube/api/collaborators';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    update: jest.fn(),
    writeInvite: jest.fn(),
    deleteInvite: jest.fn(),
    getInvite: jest.fn(),
    queryInvitesForCube: jest.fn(),
    queryInvitesForUser: jest.fn(),
    deleteInvitesForCube: jest.fn(),
    deleteInvitesForUser: jest.fn(),
    deletePin: jest.fn(),
  },
  userDao: {
    getByUsername: jest.fn(),
    getById: jest.fn(),
    batchGet: jest.fn(),
  },
  collaboratorIndexDao: {
    add: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');

jest.mock('serverutils/util', () => ({
  addNotification: jest.fn(),
  // The collaborators handlers call isAdmin to grant admins owner-equivalent
  // access. Default to false so the non-owner / collaborator paths under test
  // hit the 403 branch instead of throwing on an undefined function (which
  // would surface as a 500 here).
  isAdmin: jest.fn().mockReturnValue(false),
}));

import { collaboratorIndexDao, cubeDao, userDao } from '../../../src/dynamo/daos';
import { addNotification } from '../../../src/serverutils/util';

const invite = (cubeId: string, userId: string, invitedBy = 'owner-1') => ({
  cubeId,
  userId,
  invitedBy,
  invitedAt: 1,
});

describe('POST /cube/api/collaborators/:id/add', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('returns 404 when cube is not found', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(null);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(addCollaboratorHandler)
      .as(createUser())
      .withParams({ id: 'nonexistent' })
      .withBody({ username: 'someone' })
      .send();

    expect(res.status).toBe(404);
  });

  it('returns 403 when requester is not the owner', async () => {
    const owner = createUser({ id: 'owner-1' });
    const notOwner = createUser({ id: 'not-owner' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(false);

    const res = await call(addCollaboratorHandler)
      .as(notOwner)
      .withParams({ id: cube.id })
      .withBody({ username: 'someone' })
      .send();

    expect(res.status).toBe(403);
  });

  it('returns 403 when a collaborator tries to add another collaborator', async () => {
    const owner = createUser({ id: 'owner-1' });
    const collaborator = createUser({ id: 'collab-1' });
    const cube = createCube({ owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    // collaborator can edit but is not the owner
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);

    const res = await call(addCollaboratorHandler)
      .as(collaborator)
      .withParams({ id: cube.id })
      .withBody({ username: 'newperson' })
      .send();

    expect(res.status).toBe(403);
  });

  it('returns 400 when username is missing from body', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(addCollaboratorHandler).as(owner).withParams({ id: cube.id }).withBody({}).send();

    expect(res.status).toBe(400);
  });

  it('returns 404 when the target username does not exist', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(null);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'ghost' })
      .send();

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user/i);
  });

  it('returns 400 when target user is already a collaborator', async () => {
    const owner = createUser({ id: 'owner-1' });
    const target = createUser({ id: 'collab-1', username: 'alice' });
    const cube = createCube({ owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'alice' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });

  it('returns 400 when trying to add the owner as a collaborator', async () => {
    const owner = createUser({ id: 'owner-1', username: 'bob' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(owner);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'bob' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/owner/i);
  });

  it('creates an invite instead of adding the collaborator', async () => {
    const owner = createUser({ id: 'owner-1', username: 'owneruser' });
    const target = createUser({ id: 'collab-new', username: 'newcollab' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(undefined);
    (cubeDao.queryInvitesForCube as jest.Mock).mockResolvedValue([]);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'newcollab' })
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      invite: { id: 'collab-new', username: 'newcollab', imageUri: null },
    });
    expect(cubeDao.writeInvite).toHaveBeenCalledWith(cube.id, target.id, owner.id);
    expect(cubeDao.update).not.toHaveBeenCalled();
    expect(collaboratorIndexDao.add).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      target,
      owner,
      `/user/collaborations/${target.id}`,
      `${owner.username} invited you to collaborate on "${cube.name}"`,
    );
  });

  it('returns 400 when the user already has a pending invite', async () => {
    const owner = createUser({ id: 'owner-1' });
    const target = createUser({ id: 'collab-new', username: 'newcollab' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite(cube.id, target.id));
    (cubeDao.queryInvitesForCube as jest.Mock).mockResolvedValue([invite(cube.id, target.id)]);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'newcollab' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('That user already has a pending invite');
    expect(cubeDao.writeInvite).not.toHaveBeenCalled();
  });

  it('counts pending invites toward the 20 collaborator cap', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: Array.from({ length: 15 }, (_, i) => `collab-${i}`) });
    const target = createUser({ id: 'collab-new', username: 'newcollab' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(undefined);
    (cubeDao.queryInvitesForCube as jest.Mock).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => invite(cube.id, `pending-${i}`)),
    );

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'newcollab' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This cube has reached the maximum of 20 collaborators');
    expect(cubeDao.writeInvite).not.toHaveBeenCalled();
  });

  it('returns 400 when collaborator cap is reached', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: Array.from({ length: 20 }, (_, i) => `collab-${i}`) });
    const target = createUser({ id: 'collab-new', username: 'newcollab' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(undefined);
    (cubeDao.queryInvitesForCube as jest.Mock).mockResolvedValue([]);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'newcollab' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/maximum/i);
  });
});

describe('POST /cube/api/collaborators/:id/add errors', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('reports an unexpected failure as an invite error', async () => {
    (cubeDao.getById as jest.Mock).mockRejectedValue(new Error('boom'));

    const res = await call(addCollaboratorHandler)
      .as(createUser())
      .withParams({ id: 'cube-1' })
      .withBody({ username: 'someone' })
      .send();

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error inviting collaborator');
  });
});

describe('POST /cube/api/collaborators/:id/invite/accept', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('accepts an invite to a private cube the invitee cannot view', async () => {
    const owner = createUser({ id: 'owner-1' });
    const invitee = createUser({ id: 'invitee-1' });
    const cube = createCube({ id: 'cube-id-1', owner, visibility: 'pr', collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite(cube.id, invitee.id));
    (userDao.getById as jest.Mock).mockResolvedValue(owner);

    const res = await call(acceptInviteHandler).as(invitee).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.getInvite).toHaveBeenCalledWith('cube-id-1', 'invitee-1');
    expect(cubeDao.update).toHaveBeenCalledWith(expect.objectContaining({ collaborators: ['collab-1', 'invitee-1'] }));
    expect(collaboratorIndexDao.add).toHaveBeenCalledWith('invitee-1', 'cube-id-1');
    expect(cubeDao.deleteInvite).toHaveBeenCalledWith('cube-id-1', 'invitee-1');
  });

  it('returns 403 when there is no invite for the requester', async () => {
    const owner = createUser({ id: 'owner-1' });
    const invitee = createUser({ id: 'invitee-1' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(undefined);

    const res = await call(acceptInviteHandler).as(invitee).withParams({ id: cube.id }).send();

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No pending invite');
    expect(cubeDao.update).not.toHaveBeenCalled();
    expect(collaboratorIndexDao.add).not.toHaveBeenCalled();
  });

  it('returns 404 and deletes the invite when the cube is gone', async () => {
    const invitee = createUser({ id: 'invitee-1' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(null);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite('gone-cube', invitee.id));

    const res = await call(acceptInviteHandler).as(invitee).withParams({ id: 'gone-cube' }).send();

    expect(res.status).toBe(404);
    expect(cubeDao.deleteInvite).toHaveBeenCalledWith('gone-cube', 'invitee-1');
    expect(collaboratorIndexDao.add).not.toHaveBeenCalled();
  });

  it('returns 400 and keeps the invite when the cube is at the cap', async () => {
    const owner = createUser({ id: 'owner-1' });
    const invitee = createUser({ id: 'invitee-1' });
    const cube = createCube({ owner, collaborators: Array.from({ length: 20 }, (_, i) => `collab-${i}`) });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite(cube.id, invitee.id));

    const res = await call(acceptInviteHandler).as(invitee).withParams({ id: cube.id }).send();

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This cube has reached the maximum of 20 collaborators');
    expect(cubeDao.deleteInvite).not.toHaveBeenCalled();
    expect(cubeDao.update).not.toHaveBeenCalled();
    expect(collaboratorIndexDao.add).not.toHaveBeenCalled();
  });

  it('is idempotent when the invitee is already a collaborator', async () => {
    const owner = createUser({ id: 'owner-1' });
    const invitee = createUser({ id: 'invitee-1' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: ['invitee-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite(cube.id, invitee.id));
    (userDao.getById as jest.Mock).mockResolvedValue(owner);

    const res = await call(acceptInviteHandler).as(invitee).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.update).not.toHaveBeenCalled();
    expect(cubeDao.deleteInvite).toHaveBeenCalledWith('cube-id-1', 'invitee-1');
  });

  it('notifies the owner on accept', async () => {
    const owner = createUser({ id: 'owner-1' });
    const invitee = createUser({ id: 'invitee-1', username: 'inviteeuser' });
    const cube = createCube({ id: 'cube-id-1', shortId: 'shorty', owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite(cube.id, invitee.id));
    (userDao.getById as jest.Mock).mockResolvedValue(owner);

    const res = await call(acceptInviteHandler).as(invitee).withParams({ id: cube.id }).send();

    expect(res.status).toBe(200);
    expect(userDao.getById).toHaveBeenCalledWith('owner-1');
    expect(addNotification).toHaveBeenCalledWith(
      owner,
      invitee,
      '/cube/list/shorty',
      `${invitee.username} accepted your invite to collaborate on "${cube.name}"`,
    );
  });
});

describe('POST /cube/api/collaborators/:id/invite/decline', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('deletes the invite and notifies nobody', async () => {
    const invitee = createUser({ id: 'invitee-1' });

    (cubeDao.getInvite as jest.Mock).mockResolvedValue(invite('cube-id-1', invitee.id));

    const res = await call(declineInviteHandler).as(invitee).withParams({ id: 'cube-id-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.deleteInvite).toHaveBeenCalledWith('cube-id-1', 'invitee-1');
    expect(addNotification).not.toHaveBeenCalled();
    expect(cubeDao.update).not.toHaveBeenCalled();
    expect(collaboratorIndexDao.add).not.toHaveBeenCalled();
  });

  it('returns 403 without an invite', async () => {
    const invitee = createUser({ id: 'invitee-1' });

    (cubeDao.getInvite as jest.Mock).mockResolvedValue(undefined);

    const res = await call(declineInviteHandler).as(invitee).withParams({ id: 'cube-id-1' }).send();

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('No pending invite');
    expect(cubeDao.deleteInvite).not.toHaveBeenCalled();
  });
});

describe('DELETE /cube/api/collaborators/:id/invite/:userId', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('lets the owner cancel a pending invite', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(cancelInviteHandler).as(owner).withParams({ id: cube.id, userId: 'invitee-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.deleteInvite).toHaveBeenCalledWith('cube-id-1', 'invitee-1');
  });

  it('returns 403 when a non-owner cancels', async () => {
    const owner = createUser({ id: 'owner-1' });
    const stranger = createUser({ id: 'stranger-1' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(cancelInviteHandler).as(stranger).withParams({ id: cube.id, userId: 'invitee-1' }).send();

    expect(res.status).toBe(403);
    expect(cubeDao.deleteInvite).not.toHaveBeenCalled();
  });
});

describe('GET /cube/api/collaborators/:id', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('includes pending invites only for the owner', async () => {
    const owner = createUser({ id: 'owner-1' });
    const stranger = createUser({ id: 'stranger-1' });
    const collaborator = createUser({ id: 'collab-1', username: 'collabuser' });
    const pendingUser = createUser({ id: 'pending-1', username: 'pendinguser' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.queryInvitesForCube as jest.Mock).mockResolvedValue([invite(cube.id, 'pending-1')]);
    (userDao.batchGet as jest.Mock).mockImplementation(async (ids: string[]) =>
      [collaborator, pendingUser].filter((u) => ids.includes(u.id)),
    );

    const ownerRes = await call(listCollaboratorsHandler).as(owner).withParams({ id: cube.id }).send();

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.collaborators).toEqual([{ id: 'collab-1', username: 'collabuser', imageUri: null }]);
    expect(ownerRes.body.pending).toEqual([{ id: 'pending-1', username: 'pendinguser', imageUri: null }]);

    const strangerRes = await call(listCollaboratorsHandler).as(stranger).withParams({ id: cube.id }).send();

    expect(strangerRes.status).toBe(200);
    expect(strangerRes.body.collaborators).toEqual([{ id: 'collab-1', username: 'collabuser', imageUri: null }]);
    expect(strangerRes.body).not.toHaveProperty('pending');
  });
});

describe('DELETE /cube/api/collaborators/:id/:userId', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('returns 404 when cube is not found', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(null);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(removeCollaboratorHandler)
      .as(createUser())
      .withParams({ id: 'nonexistent', userId: 'someone' })
      .send();

    expect(res.status).toBe(404);
  });

  it('returns 403 when requester is not the owner', async () => {
    const owner = createUser({ id: 'owner-1' });
    const notOwner = createUser({ id: 'not-owner' });
    const cube = createCube({ owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(removeCollaboratorHandler)
      .as(notOwner)
      .withParams({ id: cube.id, userId: 'collab-1' })
      .send();

    expect(res.status).toBe(403);
  });

  it('returns 200 when the user is not a collaborator (idempotent)', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(removeCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id, userId: 'not-a-collab' })
      .send();

    expect(res.status).toBe(200);
    // A retry after a partial failure still cleans up a leftover pin.
    expect(cubeDao.deletePin).toHaveBeenCalledWith(cube.id, 'not-a-collab');
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('removes the collaborator, saves the cube, and deletes the index row on success', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: ['collab-1', 'collab-2'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.update as jest.Mock).mockResolvedValue(undefined);
    (collaboratorIndexDao.remove as jest.Mock).mockResolvedValue(undefined);

    const res = await call(removeCollaboratorHandler).as(owner).withParams({ id: cube.id, userId: 'collab-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.update).toHaveBeenCalledWith(expect.objectContaining({ collaborators: ['collab-2'] }));
    expect(collaboratorIndexDao.remove).toHaveBeenCalledWith('collab-1', 'cube-id-1');
  });

  it('deletes the pin of the removed collaborator', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(removeCollaboratorHandler).as(owner).withParams({ id: cube.id, userId: 'collab-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.deletePin).toHaveBeenCalledWith('cube-id-1', 'collab-1');
    // Before the membership writes, so a failure there leaves a retry that still cleans up the pin.
    const pinOrder = (cubeDao.deletePin as jest.Mock).mock.invocationCallOrder[0]!;
    expect(pinOrder).toBeLessThan((cubeDao.update as jest.Mock).mock.invocationCallOrder[0]!);
    expect(pinOrder).toBeLessThan((collaboratorIndexDao.remove as jest.Mock).mock.invocationCallOrder[0]!);
  });

  it('allows a collaborator to remove themselves', async () => {
    const owner = createUser({ id: 'owner-1' });
    const collaborator = createUser({ id: 'collab-1' });
    const cube = createCube({ id: 'cube-id-1', owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.update as jest.Mock).mockResolvedValue(undefined);
    (collaboratorIndexDao.remove as jest.Mock).mockResolvedValue(undefined);

    const res = await call(removeCollaboratorHandler)
      .as(collaborator)
      .withParams({ id: cube.id, userId: 'collab-1' })
      .send();

    expect(res.status).toBe(200);
    expect(cubeDao.update).toHaveBeenCalledWith(expect.objectContaining({ collaborators: [] }));
    expect(collaboratorIndexDao.remove).toHaveBeenCalledWith('collab-1', 'cube-id-1');
  });
});
