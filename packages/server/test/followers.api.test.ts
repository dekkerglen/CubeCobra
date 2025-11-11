import Cube from '../src/dynamo/models/cube';
import User from '../src/dynamo/models/user';
import { ensureCubeVisible, getFollowers } from '../src/router/routes/api/followers';
import CubeFn from 'serverutils/cubefn';
import { createCube, createUser } from './test-utils/data';
import { expectRegisteredRoutes } from './test-utils/route';
import { call, middleware } from './test-utils/transport';

jest.mock('../src/dynamo/models/user');
jest.mock('../src/dynamo/models/cube');
jest.mock('serverutils/cubefn');

describe('Followers API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should get followers for a user', async () => {
    const mockUser = createUser({ following: ['user1', 'user2'] });
    (User.getById as jest.Mock).mockResolvedValue(mockUser);
    const users = [createUser({ id: 'user1' }), createUser({ id: 'user2' })];
    (User.batchGet as jest.Mock).mockResolvedValue(users);

    const res = await call(getFollowers)
      .withParams({ id: '123', type: 'user' })
      .withQuery({ limit: '2', skip: '0' })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      followers: users,
      hasMore: false,
    });
  });

  it('should get followers for a cube', async () => {
    const mockCube = createCube({ following: ['user1', 'user2', 'user3'] });
    (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
    const users = [createUser({ id: 'user1' }), createUser({ id: 'user2' })];
    (User.batchGet as jest.Mock).mockResolvedValue(users);

    const res = await call(getFollowers)
      .withParams({ id: '123', type: 'cube' })
      .withResponseLocals({
        cube: mockCube,
      })
      .withQuery({ limit: '2', skip: '0' })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      followers: users,
      hasMore: true,
    });
  });

  it('should return 400 for unknown follower type', async () => {
    const res = await call(getFollowers).withParams({ id: '123', type: 'unknown' }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({ error: 'Unknown follower type' });
  });

  it('should handle errors', async () => {
    (User.getById as jest.Mock).mockRejectedValue(new Error('Failed to get user'));

    const res = await call(getFollowers).withParams({ id: '123', type: 'user' }).send();

    expect(res.status).toEqual(500);
    expect(res.body).toEqual({ error: 'Error' });
  });

  it('should handle more followers than the limit', async () => {
    const mockUser = createUser({ following: ['user1', 'user2', 'user3', 'user4'] });
    (User.getById as jest.Mock).mockResolvedValue(mockUser);
    const usersSetOne = [createUser({ id: 'user1' }), createUser({ id: 'user2' })];
    const usersSetTwo = [createUser({ id: 'user3' }), createUser({ id: 'user4' })];
    (User.batchGet as jest.Mock).mockResolvedValueOnce(usersSetOne);
    (User.batchGet as jest.Mock).mockResolvedValueOnce(usersSetTwo);

    const res = await call(getFollowers)
      .withParams({ id: '123', type: 'user' })
      .withQuery({ limit: '2', skip: '0' })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      followers: usersSetOne,
      hasMore: true,
    });

    const pageTwo = await call(getFollowers)
      .withParams({ id: '123', type: 'user' })
      .withQuery({ limit: '2', skip: '2' })
      .send();

    expect(pageTwo.status).toEqual(200);
    expect(pageTwo.body).toEqual({
      followers: usersSetTwo,
      hasMore: false,
    });
  });
});

describe('Ensure Cube Visible Middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call next if cube is viewable', async () => {
    const mockCube = { id: '123', viewable: true };
    (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await middleware(ensureCubeVisible).withParams({ id: '123', type: 'cube' }).as(createUser()).send();

    expect(res.nextCalled).toBeTruthy();
    expect(res.rawResponse.locals.cube).toEqual(mockCube);
  });

  it('should return 404 if cube is not viewable', async () => {
    (Cube.getById as jest.Mock).mockResolvedValue(null);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await middleware(ensureCubeVisible).withParams({ id: '123', type: 'cube' }).as(createUser()).send();

    expect(res.status).toEqual(404);
    expect(res.body).toEqual({ error: 'Cube not found' });
  });
});

describe('Followers Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/api/followers/:type/:id',
        method: 'get',
      },
    ]);
  });
});
