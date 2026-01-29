// import * as filterCards from '../@utils/filtering/FilterCards';
import CubeFn from 'serverutils/cubefn';
import * as Util from 'serverutils/util';

import { editOverviewHandler } from '../../../src/router/routes/cube/api/editoverview';
import { createCube, createUser } from '../../test-utils/data';
import { expectRegisteredRoutes } from '../../test-utils/route';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('serverutils/cubefn');
jest.mock('serverutils/util');
jest.mock('../../../src/dynamo/models/cubeHash');

import { cubeDao } from '../../../src/dynamo/daos';

describe('Edit overview API', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should fail if the cube isnt found', async () => {
    const cube = createCube();

    (cubeDao.getById as jest.Mock).mockResolvedValue(false);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(editOverviewHandler).withBody({ cube: cube }).send();

    expect(res.status).toEqual(404);
    expect(res.body).toEqual({
      error: 'Cube not found',
    });
  });

  it('should fail if no current user (eg not authenticated)', async () => {
    const owner = createUser({ id: '12345' });
    const cube = createCube({ owner });

    (cubeDao.getById as jest.Mock).mockResolvedValue(false);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(editOverviewHandler).withBody({ cube: cube }).send();

    expect(res.status).toEqual(404);
    expect(res.body).toEqual({
      error: 'Cube not found',
    });
  });

  it('should fail if no current user is not the cube owner', async () => {
    const owner = createUser({ id: '12345' });
    const cube = createCube({ owner });
    const currentUser = createUser({ id: '56789' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: cube }).send();

    expect(res.status).toEqual(403);
    expect(res.body).toEqual({
      error: 'Unauthorized',
    });
  });

  it('should fail if the cube is empty', async () => {
    const owner = createUser({ id: '12345' });
    const cube = createCube({ owner, cardCount: 0 });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: cube }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('Cannot update the cube overview for an empty cube'),
    });
  });

  it('should fail if the name is profane', async () => {
    const owner = createUser({ id: '12345' });
    const cube = createCube({ owner, name: 'Bad words' });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(true);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: cube }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('Could not update cube, the name contains a banned word'),
    });
  });

  it('should fail if the new short id is profane', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const newCube = createCube({ shortId: 'Bad words', owner });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: newCube }).send();

    expect(Util.hasProfanity as jest.Mock).toHaveBeenNthCalledWith(1, newCube.name);
    expect(Util.hasProfanity as jest.Mock).toHaveBeenNthCalledWith(2, newCube.shortId);
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('Could not update cube, the short id contains a banned word'),
    });
  });

  it('should fail if the new short id already taken', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const newCube = createCube({ ...existingCube, shortId: 'Foobar', owner });
    const currentUser = owner;
    const otherCube = createCube({ shortId: 'Foobar', id: 'other-cube-id' });

    (cubeDao.getById as jest.Mock).mockImplementation((id: string) => {
      if (id === existingCube.id) return Promise.resolve(existingCube);
      if (id === 'Foobar') return Promise.resolve(otherCube);
      return Promise.resolve(null);
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: newCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, newCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, newCube.shortId);
    expect(cubeDao.getById).toHaveBeenCalledWith('Foobar');
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('the short id is already taken'),
    });
  });

  it('should fail if the new short id already taken by multiple cubes', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const newCube = createCube({ ...existingCube, shortId: 'Foobar', owner });
    const currentUser = owner;
    const otherCube = createCube({ shortId: 'Foobar', id: 'other-cube-id' });

    (cubeDao.getById as jest.Mock).mockImplementation((id: string) => {
      if (id === existingCube.id) return Promise.resolve(existingCube);
      if (id === 'Foobar') return Promise.resolve(otherCube);
      return Promise.resolve(null);
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: newCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, newCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, newCube.shortId);
    expect(cubeDao.getById).toHaveBeenCalledWith('Foobar');
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('the short id is already taken'),
    });
  });

  it('should update cube successfully', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({
      ...existingCube,
      shortId: 'bar',
      owner,
      name: 'Updated Cube',
      description: 'New description',
      tags: ['Foo', 'BAR', 'baz', ''],
      //@ts-expect-error -- Per the Cube type categoryOverride/categoryPrefixes cannot be null but the handler doesn't guarantee the input is a Cube type, so still checks
      categoryOverride: null,
      //@ts-expect-error -- ditto
      categoryPrefixes: null,
    });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockImplementation((id: string) => {
      if (id === existingCube.id) return Promise.resolve(existingCube);
      if (id === 'bar') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeFn.getCubeId as jest.Mock).mockReturnValue(updatedCube.shortId);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, updatedCube.shortId);
    expect(cubeDao.getById).toHaveBeenCalledWith('bar');
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        name: updatedCube.name,
        description: updatedCube.description,
        shortId: updatedCube.shortId,
        date: expect.any(Number),
        tags: ['foo', 'bar', 'baz'],
        categoryPrefixes: [],
      }),
    );
    expect((cubeDao.update as jest.Mock).mock.calls[0][0].date).toBeGreaterThanOrEqual(existingCube.date);
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
      redirect: `/cube/primer/${updatedCube.shortId}`,
    });
  });

  it('should update cube successfully, when no short id', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: '', owner });
    const updatedCube = createCube({
      ...existingCube,
      owner,
      name: 'Updated Cube',
      description: 'New description',
    });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeFn.getCubeId as jest.Mock).mockReturnValue(updatedCube.id);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        name: updatedCube.name,
        description: updatedCube.description,
        date: expect.any(Number),
      }),
    );
    expect((cubeDao.update as jest.Mock).mock.calls[0][0].date).toBeGreaterThanOrEqual(existingCube.date);
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
      redirect: `/cube/primer/${updatedCube.id}`,
    });
  });

  it('should fail if the category override is invalid', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({ ...existingCube, owner, categoryOverride: 'InvalidCategory' });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: 'Not a valid category override.',
    });
  });

  it('should fail if the category prefix is invalid', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({ ...existingCube, owner, categoryPrefixes: ['InvalidPrefix'] });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: 'Not a valid category prefix.',
    });
  });

  it('should update cube with valid category override and prefixes', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({
      ...existingCube,
      shortId: 'bar',
      owner,
      categoryOverride: 'Modern',
      categoryPrefixes: ['Powered', 'Pauper'],
    });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockImplementation((id: string) => {
      if (id === existingCube.id) return Promise.resolve(existingCube);
      if (id === 'bar') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeFn.getCubeId as jest.Mock).mockReturnValue(updatedCube.shortId);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, updatedCube.shortId);
    expect(cubeDao.getById).toHaveBeenCalledWith('bar');
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        categoryOverride: updatedCube.categoryOverride,
        categoryPrefixes: updatedCube.categoryPrefixes,
      }),
    );
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
      redirect: `/cube/primer/${updatedCube.shortId}`,
    });
  });

  it('should handle errors', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({ shortId: 'bar', owner });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (cubeDao.update as jest.Mock).mockRejectedValue(new Error('Update failed'));

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(res.status).toEqual(500);
    expect(res.body).toEqual({
      error: 'Error updating cube',
    });
  });

  it('when the short id changes, should update cube and return the new URL', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ id: 'aaaaaaaaa-bbbbbb', shortId: 'foo', owner });
    const updatedCube = createCube({
      ...existingCube,
      shortId: 'newid',
      owner,
      name: 'Updated Cube',
      description: 'New description',
    });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockImplementation((id: string) => {
      if (id === existingCube.id) return Promise.resolve(existingCube);
      if (id === 'newid') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeFn.getCubeId as jest.Mock).mockReturnValue(updatedCube.shortId);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, updatedCube.shortId);
    expect(cubeDao.getById).toHaveBeenCalledWith('newid');
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        name: updatedCube.name,
        description: updatedCube.description,
        shortId: updatedCube.shortId,
        date: expect.any(Number),
      }),
    );
    expect((cubeDao.update as jest.Mock).mock.calls[0][0].date).toBeGreaterThanOrEqual(existingCube.date);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
      redirect: `/cube/primer/${updatedCube.shortId}`,
    });
    expect(res.status).toEqual(200);
  });

  it('when the short id is removed, should update cube and return the guid URL', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({
      ...existingCube,
      shortId: '',
      owner,
      name: 'Updated Cube',
      description: 'New description',
    });
    const currentUser = owner;

    (cubeDao.getById as jest.Mock).mockImplementation((id: string) => {
      if (id === existingCube.id) return Promise.resolve(existingCube);
      if (id === '') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeFn.getCubeId as jest.Mock).mockReturnValue(updatedCube.id);

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, updatedCube.shortId);
    expect(cubeDao.getById).toHaveBeenCalledWith('');
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        name: updatedCube.name,
        description: updatedCube.description,
        shortId: updatedCube.shortId,
        date: expect.any(Number),
      }),
    );
    expect((cubeDao.update as jest.Mock).mock.calls[0][0].date).toBeGreaterThanOrEqual(existingCube.date);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
      redirect: `/cube/primer/${updatedCube.id}`,
    });
    expect(res.status).toEqual(200);
  });
});

describe('Edit overview Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/cube/api/editoverview/',
        method: 'post',
      },
    ]);
  });
});
