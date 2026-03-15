import CubeFn from 'serverutils/cubefn';

import { addCollaboratorHandler, removeCollaboratorHandler } from '../../../src/router/routes/cube/api/collaborators';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
  userDao: {
    getByUsername: jest.fn(),
    getById: jest.fn(),
  },
  collaboratorIndexDao: {
    add: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn');

import { collaboratorIndexDao, cubeDao, userDao } from '../../../src/dynamo/daos';

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

  it('adds the user, saves the cube, and writes the index row on success', async () => {
    const owner = createUser({ id: 'owner-1' });
    const target = createUser({ id: 'collab-new', username: 'newcollab' });
    const cube = createCube({ owner, collaborators: [] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);
    (cubeDao.update as jest.Mock).mockResolvedValue(undefined);
    (collaboratorIndexDao.add as jest.Mock).mockResolvedValue(undefined);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'newcollab' })
      .send();

    expect(res.status).toBe(200);
    expect(cubeDao.update).toHaveBeenCalledWith(expect.objectContaining({ collaborators: ['collab-new'] }));
    expect(collaboratorIndexDao.add).toHaveBeenCalledWith('collab-new', cube.id);
  });

  it('returns 400 when collaborator cap is reached', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: Array.from({ length: 20 }, (_, i) => `collab-${i}`) });
    const target = createUser({ id: 'collab-new', username: 'newcollab' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (userDao.getByUsername as jest.Mock).mockResolvedValue(target);

    const res = await call(addCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ username: 'newcollab' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/maximum/i);
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

  it('returns 400 when the user is not a collaborator', async () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: ['collab-1'] });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(removeCollaboratorHandler)
      .as(owner)
      .withParams({ id: cube.id, userId: 'not-a-collab' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a collaborator/i);
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
