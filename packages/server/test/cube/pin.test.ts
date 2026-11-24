import { pinHandler, unpinHandler } from '../../src/router/routes/cube';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/siteActivity', () => ({ recordSiteActivity: jest.fn() }));

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    writePin: jest.fn(),
    deletePin: jest.fn(),
  },
}));

import { cubeDao } from '../../src/dynamo/daos';

const owner = createUser({ id: 'owner-1' });
const user = createUser({ id: 'user-1' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pinHandler', () => {
  it('lets the owner pin', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', owner, collaborators: [] }));

    const res = await call(pinHandler).as(owner).withParams({ id: 'cube-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.writePin).toHaveBeenCalledWith('cube-1', owner.id);
  });

  it('lets an accepted collaborator pin', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', owner, collaborators: [user.id] }));

    const res = await call(pinHandler).as(user).withParams({ id: 'cube-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.writePin).toHaveBeenCalledWith('cube-1', user.id);
  });

  it('forbids pinning by a non-collaborator', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', owner, collaborators: [] }));

    const res = await call(pinHandler).as(user).withParams({ id: 'cube-1' }).send();

    expect(res.status).toBe(403);
    expect(cubeDao.writePin).not.toHaveBeenCalled();
  });

  it('returns 404 when the cube does not exist', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(null);

    const res = await call(pinHandler).as(user).withFlash(jest.fn()).withParams({ id: 'missing' }).send();

    expect(res.status).toBe(404);
    expect(cubeDao.writePin).not.toHaveBeenCalled();
  });
});

describe('unpinHandler', () => {
  it('lets a former collaborator unpin', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', owner, collaborators: [] }));

    const res = await call(unpinHandler).as(user).withParams({ id: 'cube-1' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.deletePin).toHaveBeenCalledWith('cube-1', user.id);
  });

  it('deletes the pin under the resolved cube id when addressed by shortId', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'cube-1', shortId: 'short', owner }));

    const res = await call(unpinHandler).as(user).withParams({ id: 'short' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.deletePin).toHaveBeenCalledWith('cube-1', user.id);
  });

  it('unpins even when the cube no longer exists', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(null);

    const res = await call(unpinHandler).as(user).withParams({ id: 'gone-cube' }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.deletePin).toHaveBeenCalledWith('gone-cube', user.id);
  });
});
