// import * as filterCards from '../../../src/client/filtering/FilterCards';
import Cube from '../../../src/dynamo/models/cube';
import CubeHash from '../../../src/dynamo/models/cubeHash';
import { editOverviewHandler } from '../../../src/router/routes/cube/api/editoverview';
import CubeFn from '../../../src/util/cubefn';
import Util from '../../../src/util/util';
import { createCube, createUser } from '../../test-utils/data';
import { expectRegisteredRoutes } from '../../test-utils/route';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/models/cube');
jest.mock('../../../src/util/cubefn');
jest.mock('../../../src/util/util');
jest.mock('../../../src/dynamo/models/cubeHash');

describe('Edit overview API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail if the cube isnt found', async () => {
    const cube = createCube();

    (Cube.getById as jest.Mock).mockResolvedValue(false);
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

    (Cube.getById as jest.Mock).mockResolvedValue(false);
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

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
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

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
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

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
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

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
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
    const newCube = createCube({ shortId: 'Foobar', owner });
    const currentUser = owner;

    const otherCubeHash = {
      name: 'OtherCube',
      cube: 'abcdefgh',
      hash: 'shortid:foobar',
      numFollowers: 0,
      cardCount: 540,
    };

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeHash.getSortedByName as jest.Mock).mockResolvedValue({
      items: [otherCubeHash],
      lastKey: null,
    });

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: newCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, newCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, newCube.shortId);
    expect(CubeHash.getSortedByName).toHaveBeenCalledWith(`shortid:foobar`);
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('Custom URL is already taken'),
    });
  });

  it('should fail if the new short id already taken by multiple cubes', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const newCube = createCube({ shortId: 'Foobar', owner });
    const currentUser = owner;

    const otherCubeHash = {
      name: 'OtherCube',
      cube: 'abcdefgh',
      hash: 'shortid:foobar',
      numFollowers: 0,
      cardCount: 540,
    };
    const otherCubeHashTwo = {
      name: 'OtherCube2',
      cube: 'aaa-bbb-ccc',
      hash: 'shortid:foobar',
      numFollowers: 5,
      cardCount: 340,
    };

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeHash.getSortedByName as jest.Mock).mockResolvedValue({
      items: [otherCubeHash, otherCubeHashTwo],
      lastKey: null,
    });

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: newCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, newCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, newCube.shortId);
    expect(CubeHash.getSortedByName).toHaveBeenCalledWith(`shortid:foobar`);
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('Custom URL is already taken'),
    });
  });

  it('should update cube successfully', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({
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

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeHash.getSortedByName as jest.Mock).mockResolvedValue({ items: [], lastKey: null });

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, updatedCube.shortId);
    expect(CubeHash.getSortedByName).toHaveBeenCalledWith(`shortid:bar`);
    expect(Cube.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        name: updatedCube.name,
        description: updatedCube.description,
        shortId: updatedCube.shortId,
        date: expect.any(Number),
        tags: ['foo', 'bar', 'baz'],
        categoryOverride: null,
        categoryPrefixes: [],
      }),
    );
    expect((Cube.update as jest.Mock).mock.calls[0][0].date).toBeGreaterThanOrEqual(existingCube.date);
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
    });
  });

  it('should fail if the category override is invalid', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({ shortId: 'bar', owner, categoryOverride: 'InvalidCategory' });
    const currentUser = owner;

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
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
    const updatedCube = createCube({ shortId: 'bar', owner, categoryPrefixes: ['InvalidPrefix'] });
    const currentUser = owner;

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
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
      shortId: 'bar',
      owner,
      categoryOverride: 'Modern',
      categoryPrefixes: ['Powered', 'Pauper'],
    });
    const currentUser = owner;

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (CubeHash.getSortedByName as jest.Mock).mockResolvedValue({ items: [], lastKey: null });

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(Util.hasProfanity).toHaveBeenNthCalledWith(1, updatedCube.name);
    expect(Util.hasProfanity).toHaveBeenNthCalledWith(2, updatedCube.shortId);
    expect(CubeHash.getSortedByName).toHaveBeenCalledWith(`shortid:bar`);
    expect(Cube.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existingCube.id,
        categoryOverride: updatedCube.categoryOverride,
        categoryPrefixes: updatedCube.categoryPrefixes,
      }),
    );
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Cube updated successfully',
    });
  });

  it('should handle errors', async () => {
    const owner = createUser({ id: '12345' });
    const existingCube = createCube({ shortId: 'foo', owner });
    const updatedCube = createCube({ shortId: 'bar', owner });
    const currentUser = owner;

    (Cube.getById as jest.Mock).mockResolvedValue(existingCube);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (Util.hasProfanity as jest.Mock).mockReturnValue(false);
    (Cube.update as jest.Mock).mockRejectedValue(new Error('Update failed'));

    const res = await call(editOverviewHandler).as(currentUser).withBody({ cube: updatedCube }).send();

    expect(res.status).toEqual(500);
    expect(res.body).toEqual({
      error: 'Error updating cube',
    });
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
