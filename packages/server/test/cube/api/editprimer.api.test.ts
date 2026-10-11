import CubeFn from 'serverutils/cubefn';

import { editPrimerHandler } from '../../../src/router/routes/cube/api/editprimer';
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

import { cubeDao } from '../../../src/dynamo/daos';

const setupOwnedCube = (overrides: Parameters<typeof createCube>[0] = {}) => {
  const owner = createUser({ id: '12345' });
  const cube = createCube({ owner, ...overrides });

  (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
  (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(true);
  (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(true);
  (CubeFn.getCubeId as jest.Mock).mockReturnValue(cube.shortId || cube.id);

  return { owner, cube };
};

describe('Edit primer API', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should fail if the cube isnt found', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(false);
    (CubeFn.isCubeViewable as jest.Mock).mockReturnValue(false);

    const res = await call(editPrimerHandler).withBody({ cubeId: 'abc' }).send();

    expect(res.status).toEqual(404);
    expect(res.body).toEqual({ error: 'Cube not found' });
  });

  it('should fail if the user cannot edit the cube', async () => {
    const { cube } = setupOwnedCube();
    (CubeFn.isCubeEditable as jest.Mock).mockReturnValue(false);

    const res = await call(editPrimerHandler)
      .as(createUser({ id: '56789' }))
      .withBody({ cubeId: cube.id, primerTabs: cube.primerTabs, tags: [] })
      .send();

    expect(res.status).toEqual(403);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('should fail if the cube is empty', async () => {
    const { owner, cube } = setupOwnedCube({ cardCount: 0 });

    const res = await call(editPrimerHandler)
      .as(owner)
      .withBody({ cubeId: cube.id, primerTabs: cube.primerTabs, tags: [] })
      .send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: expect.stringContaining('Cannot update the cube primer for an empty cube'),
    });
  });

  it('should reject more than 10 tabs', async () => {
    const { owner, cube } = setupOwnedCube();
    const primerTabs = Array.from({ length: 11 }, (_, i) => ({ title: `Tab ${i}`, content: '' }));

    const res = await call(editPrimerHandler).as(owner).withBody({ cubeId: cube.id, primerTabs, tags: [] }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({ error: 'Primer cannot have more than 10 tabs.' });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('should reject tabs that share a slug', async () => {
    const { owner, cube } = setupOwnedCube();
    const primerTabs = [
      { title: 'Notes', content: '' },
      { title: 'notes!', content: '' },
    ];

    const res = await call(editPrimerHandler).as(owner).withBody({ cubeId: cube.id, primerTabs, tags: [] }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({ error: 'Two tabs share the link name "notes". Rename one of them.' });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('should reject a title with no letters or numbers', async () => {
    const { owner, cube } = setupOwnedCube();
    const primerTabs = [{ title: '🙂', content: '' }];

    const res = await call(editPrimerHandler).as(owner).withBody({ cubeId: cube.id, primerTabs, tags: [] }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({ error: 'Tab title "🙂" must contain at least one letter or number.' });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('should reject a primer that would exceed the DynamoDB item size', async () => {
    const { owner, cube } = setupOwnedCube({
      formats: [
        {
          title: 'Padding',
          packs: [],
          multiples: false,
          markdown: 'x'.repeat(60_000),
          defaultSeats: 8,
        },
      ],
    });
    const primerTabs = [{ title: 'Primer', content: '語'.repeat(99_000) }];

    const res = await call(editPrimerHandler).as(owner).withBody({ cubeId: cube.id, primerTabs, tags: [] }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: 'This cube is too large to save. Try shortening the primer, especially tabs with non-Latin text.',
    });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('should blame other cube settings when the cube is too large without its primer', async () => {
    const { owner, cube } = setupOwnedCube({
      formats: [
        {
          title: 'Padding',
          packs: [],
          multiples: false,
          markdown: 'x'.repeat(360_000),
          defaultSeats: 8,
        },
      ],
    });
    const primerTabs = [{ title: 'Primer', content: 'tiny' }];

    const res = await call(editPrimerHandler).as(owner).withBody({ cubeId: cube.id, primerTabs, tags: [] }).send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error:
        "This cube's other settings (draft formats, views, custom sorts) are too large to save. Contact support for help.",
    });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('should reject an over-limit legacy primer even on a tags-only save', async () => {
    const legacyTabs = [{ title: 'Primer', content: 'x'.repeat(100_001) }];
    const { owner, cube } = setupOwnedCube({ primerTabs: legacyTabs });

    const res = await call(editPrimerHandler)
      .as(owner)
      .withBody({ cubeId: cube.id, primerTabs: legacyTabs, tags: ['New Tag'] })
      .send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      error: 'Primer is 100,001 characters; the limit is 100,000 across all tabs.',
    });
    expect(cubeDao.update).not.toHaveBeenCalled();
  });

  it('should save tabs and lowercased tags and redirect to the active tab', async () => {
    const { owner, cube } = setupOwnedCube({ shortId: 'myshort' });
    const primerTabs = [
      { title: 'Primer', content: 'Hello' },
      { title: 'Español', content: 'Hola' },
    ];

    const res = await call(editPrimerHandler)
      .as(owner)
      .withBody({ cubeId: cube.id, primerTabs, tags: ['Vintage', '', 'Power'], activeTab: 1 })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Primer updated successfully',
      redirect: '/cube/about/myshort?view=primer&tab=espa%C3%B1ol',
    });
    expect(cubeDao.update).toHaveBeenCalledWith(expect.objectContaining({ primerTabs, tags: ['vintage', 'power'] }));
  });

  it('should persist only title and content for each tab', async () => {
    const { owner, cube } = setupOwnedCube();
    const primerTabs = [{ title: 'Primer', content: 'x', evil: 'y' }];

    const res = await call(editPrimerHandler).as(owner).withBody({ cubeId: cube.id, primerTabs, tags: [] }).send();

    expect(res.status).toEqual(200);
    expect(cubeDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ primerTabs: [{ title: 'Primer', content: 'x' }] }),
    );
  });

  it('should not add a tab param when the first tab is active', async () => {
    const { owner, cube } = setupOwnedCube({ shortId: 'myshort' });
    const primerTabs = [
      { title: 'Primer', content: 'Hello' },
      { title: 'Español', content: 'Hola' },
    ];

    const res = await call(editPrimerHandler)
      .as(owner)
      .withBody({ cubeId: cube.id, primerTabs, tags: [], activeTab: 0 })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Primer updated successfully',
      redirect: '/cube/about/myshort?view=primer',
    });
  });

  it('should ignore an out-of-range active tab', async () => {
    const { owner, cube } = setupOwnedCube({ shortId: 'myshort' });
    const primerTabs = [{ title: 'Primer', content: 'Hello' }];

    const res = await call(editPrimerHandler)
      .as(owner)
      .withBody({ cubeId: cube.id, primerTabs, tags: [], activeTab: 5 })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'Primer updated successfully',
      redirect: '/cube/about/myshort?view=primer',
    });
  });
});

describe('Edit primer Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/cube/api/editprimer/',
        method: 'post',
      },
    ]);
  });
});
