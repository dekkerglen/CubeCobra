import { cubeDao } from '../../src/dynamo/daos';
import { getmoresearchitemsHandler } from '../../src/router/routes/search';
import { createMockRequest, createMockResponse } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    queryAllCubes: jest.fn(),
  },
}));

const queryAllCubes = cubeDao.queryAllCubes as jest.Mock;

const search = async (body: Record<string, unknown>) => {
  const req = createMockRequest({ body });
  const res = createMockResponse({});
  await getmoresearchitemsHandler(req, res);
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
