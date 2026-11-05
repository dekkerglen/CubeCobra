import { csrfProtection, ensureAuth, ensureAuthJson } from 'router/middleware';

import { getRecordsHandler, routes } from '../../../src/router/routes/cube/records/list';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  recordDao: { getByCube: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

/**
 * The records list is paginated: the first page is server-rendered with the page, and every
 * page after it comes from this endpoint (DraftReports passes it as `fetchMoreRoute`). It
 * required a signed-in user, so an anonymous visitor reading a public cube's records got a
 * 302 to the login page in place of JSON the moment they asked for more — while the first
 * page, carrying exactly the same records, had already rendered for them.
 *
 * The handler's own `isCubeViewable` check is the real gate, and it already accounts for an
 * anonymous `req.user`.
 */
describe('cube/records/list', () => {
  const cube = createCube({ id: 'my-cube', visibility: 'pu' as any });

  beforeEach(() => {
    jest.clearAllMocks();
    (recordDao.getByCube as jest.Mock).mockResolvedValue({ items: [{ id: 'rec-1' }], lastKey: undefined });
  });

  it('requires no sign-in', () => {
    const route = routes.find((r) => r.path === '/:id');

    expect(route?.handler).toContain(csrfProtection);
    expect(route?.handler).not.toContain(ensureAuth);
    expect(route?.handler).not.toContain(ensureAuthJson);
  });

  it('serves a page of a viewable cube to an anonymous reader', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(getRecordsHandler).withParams({ id: cube.id }).withBody({}).send();

    expect(res.status).toEqual(200);
    expect(res.body.records).toEqual([{ id: 'rec-1' }]);
  });

  it('passes the cursor through so a second page is not the first again', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    await call(getRecordsHandler)
      .withParams({ id: cube.id })
      .withBody({ lastKey: { sk: 'page-1-end' } })
      .send();

    expect(recordDao.getByCube).toHaveBeenCalledWith(cube.id, 20, { sk: 'page-1-end' });
  });

  // Dropping the sign-in requirement must not widen what is readable: a cube an anonymous
  // reader cannot see still answers 404, exactly as it did before.
  it('refuses a cube the reader cannot see', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'my-cube', visibility: 'pr' as any }));

    const res = await call(getRecordsHandler).withParams({ id: 'my-cube' }).withBody({}).send();

    expect(res.status).toEqual(404);
    expect(recordDao.getByCube).not.toHaveBeenCalled();
  });
});
