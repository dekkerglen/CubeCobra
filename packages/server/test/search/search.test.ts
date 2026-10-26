import { cubeDao } from '../../src/dynamo/daos';
import { getHandler, getmoresearchitemsHandler } from '../../src/router/routes/search';
import { render } from '../../src/serverutils/render';
import { createMockRequest, createMockResponse } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    queryAllCubes: jest.fn(),
  },
}));

jest.mock('serverutils/render', () => ({
  render: jest.fn(),
  redirect: jest.fn(),
}));

const queryAllCubes = cubeDao.queryAllCubes as jest.Mock;

const search = async (body: Record<string, unknown>) => {
  const req = createMockRequest({ body });
  const res = createMockResponse({});
  await getmoresearchitemsHandler(req, res);
  return queryAllCubes.mock.calls[0];
};

const load = async (query: Record<string, unknown>) => {
  const req = createMockRequest({ query: query as any, flash: jest.fn() as any });
  const res = createMockResponse({});
  await getHandler(req, res);
  return queryAllCubes.mock.calls[0];
};

describe('getmoresearchitemsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryAllCubes.mockResolvedValue({ items: [], lastKey: undefined });
  });

  // The page posts ascending as the string it keeps in the query param, and every non-empty
  // string is truthy, so "false" would otherwise sort ascending.
  it('reads ascending as a boolean rather than trusting the posted string', async () => {
    const [, ascending] = await search({ query: '', order: 'alpha', ascending: 'false', lastKey: null });

    expect(ascending).toBe(false);
  });

  it('reads the ascending string "true" as true', async () => {
    const [, ascending] = await search({ query: '', order: 'alpha', ascending: 'true', lastKey: null });

    expect(ascending).toBe(true);
  });

  it('accepts a real boolean too', async () => {
    const [, ascending] = await search({ query: '', order: 'alpha', ascending: true, lastKey: null });

    expect(ascending).toBe(true);
  });

  it('defaults to descending when ascending is missing', async () => {
    const [, ascending] = await search({ query: '', order: 'alpha', lastKey: null });

    expect(ascending).toBe(false);
  });

  it('falls back to the default order when the posted one is unknown', async () => {
    const [order] = await search({ query: '', order: 'not-an-order', ascending: 'false', lastKey: null });

    expect(order).toEqual('popularity');
  });
});

// The page load and the in-page searches that follow it have to agree, or the first results a
// shared link shows are sorted the opposite way from every search made on the page.
describe('getHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryAllCubes.mockResolvedValue({ items: [], lastKey: undefined });
  });

  it('reads the ascending query param the same way the posted body is read', async () => {
    const [, ascending] = await load({ q: '', order: 'alpha', ascending: 'true' });

    expect(ascending).toBe(true);
  });

  it('treats any other ascending value as descending', async () => {
    const [, ascending] = await load({ q: '', order: 'alpha', ascending: '1' });

    expect(ascending).toBe(false);
  });

  it('defaults to descending when ascending is missing', async () => {
    const [, ascending] = await load({ q: '', order: 'alpha' });

    expect(ascending).toBe(false);
  });

  it('renders the page it searched for', async () => {
    await load({ q: 'demo', order: 'alpha', ascending: 'true' });

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SearchPage',
      expect.objectContaining({ query: 'demo' }),
      expect.objectContaining({ title: 'Search Cubes: demo' }),
    );
  });
});
