jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  cubeDao: {
    queryByOracleId: jest.fn(),
    queryByTag: jest.fn(),
    queryByKeyword: jest.fn(),
    queryByCategory: jest.fn(),
    queryAllCubes: jest.fn(),
    queryByMultipleHashes: jest.fn(),
  },
}));

jest.mock('serverutils/carddb', () => ({
  ...jest.requireActual('serverutils/carddb'),
  getMostReasonable: jest.fn(),
  getReasonableCardByOracle: jest.fn(),
}));

jest.mock('serverutils/cubefn', () => ({
  ...jest.requireActual('serverutils/cubefn'),
  isCubeListed: jest.fn(() => true),
}));

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  render: jest.fn(),
}));

import { DefaultPrintingPreference } from '@utils/datatypes/Card';

import { cubeDao } from '../../src/dynamo/daos';
import { routes } from '../../src/router/routes/search';
import { getMostReasonable, getReasonableCardByOracle } from '../../src/serverutils/carddb';
import { isCubeListed } from '../../src/serverutils/cubefn';
import { render } from '../../src/serverutils/render';
import { call } from '../test-utils/transport';
const searchHandler = routes.find((route) => route.path === '')!.handler.at(-1)!;
const moreSearchItemsHandler = routes.find((route) => route.path === '/getmoresearchitems')!.handler.at(-1)!;

const renderedProps = () => (render as jest.Mock).mock.calls[0]![3];

const SUMMON_NAME = 'Summon: Esper Valigarmanda';
const SUMMON_ORACLE = 'oracle-summon-esper';

const search = (q: string) =>
  call(searchHandler as any)
    .withQuery({ q })
    .withFlash(jest.fn())
    .send();

describe('cube search query parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.queryByOracleId as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (cubeDao.queryByTag as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (cubeDao.queryByKeyword as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (cubeDao.queryByCategory as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (cubeDao.queryAllCubes as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (cubeDao.queryByMultipleHashes as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (getMostReasonable as jest.Mock).mockImplementation((name: string) =>
      name === SUMMON_NAME ? { oracle_id: SUMMON_ORACLE, name: SUMMON_NAME } : null,
    );
    (getReasonableCardByOracle as jest.Mock).mockReturnValue({ name: SUMMON_NAME });
  });

  it('keeps colons that belong to the card name', async () => {
    await search(`card:"${SUMMON_NAME}"`);

    expect(getMostReasonable).toHaveBeenCalledWith(SUMMON_NAME, DefaultPrintingPreference);
    expect(cubeDao.queryByOracleId).toHaveBeenCalledWith(
      SUMMON_ORACLE,
      expect.anything(),
      expect.anything(),
      undefined,
      36,
      undefined,
    );
    expect(renderedProps().parsedQuery).toEqual([`Cube contains ${SUMMON_NAME}`]);
  });

  it('keeps colons in tag values', async () => {
    await search('tag:"combo: ramp"');

    expect(cubeDao.queryByTag).toHaveBeenCalledWith(
      'combo: ramp',
      expect.anything(),
      expect.anything(),
      undefined,
      36,
      undefined,
    );
    expect(renderedProps().parsedQuery).toEqual(['Cube has tag "combo: ramp"']);
  });

  it('keeps colons in category values', async () => {
    await search('category:"legacy: powered"');

    expect(cubeDao.queryByCategory).toHaveBeenCalledWith(
      'legacy: powered',
      expect.anything(),
      expect.anything(),
      undefined,
      36,
      undefined,
    );
    expect(renderedProps().parsedQuery).toEqual(['Cube category "legacy: powered"']);
  });

  // An oracle id never contains a colon, but the token it arrives in is parsed the same way.
  it('keeps colons in oracle values', async () => {
    await search('oracle:"abc:def"');

    expect(cubeDao.queryByOracleId).toHaveBeenCalledWith(
      'abc:def',
      expect.anything(),
      expect.anything(),
      undefined,
      36,
      undefined,
    );
  });

  it('passes whole values through to the multi-hash query', async () => {
    await search(`card:"${SUMMON_NAME}" tag:"combo: ramp"`);

    expect(cubeDao.queryByMultipleHashes).toHaveBeenCalledWith(
      [`oracle:${SUMMON_ORACLE}`, 'tag:combo: ramp'],
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
    );
  });

  it('still reports cards it cannot identify', async () => {
    await search('card:"Not A Real Card"');

    expect(renderedProps().parsedQuery).toEqual(['Ignoring card query: could not identify card']);
  });

  it('still treats a bare token as a name keyword', async () => {
    await search('vintage');

    expect(cubeDao.queryByKeyword).toHaveBeenCalledWith(
      'vintage',
      expect.anything(),
      expect.anything(),
      undefined,
      36,
      undefined,
    );
    expect(renderedProps().parsedQuery).toEqual(['Cube name contains "vintage"']);
  });

  it('still parses size filters', async () => {
    await search('size>250');

    expect(cubeDao.queryAllCubes).toHaveBeenCalledWith(expect.anything(), expect.anything(), undefined, 36, {
      operator: 'gt',
      value: 250,
    });
    expect(renderedProps().parsedQuery).toEqual(['Cube size > 250 cards']);
  });
});

describe('cube search visibility refill', () => {
  // Cubes carry the listedness the mocked predicate reads, standing in for the per-viewer
  // visibility rules that cannot be expressed in the DynamoDB query.
  const makeCubes = (prefix: string, count: number, listed: boolean) =>
    Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, listed }));

  const searchMore = (lastKey: any = null) =>
    call(moreSearchItemsHandler as any)
      .withBody({ query: 'vintage', order: 'pop', ascending: 'false', lastKey })
      .send();

  beforeEach(() => {
    jest.clearAllMocks();
    // A full reset, not just a clear: an unconsumed `mockResolvedValueOnce` queue would otherwise
    // leak into the next test, since these cases deliberately leave pages unfetched.
    (cubeDao.queryByKeyword as jest.Mock).mockReset();
    (cubeDao.queryByKeyword as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (getMostReasonable as jest.Mock).mockReturnValue(null);
    (isCubeListed as jest.Mock).mockImplementation((cube: any) => cube.listed !== false);
  });

  afterEach(() => {
    (isCubeListed as jest.Mock).mockImplementation(() => true);
  });

  it('refills a page that visibility filtering left short', async () => {
    (cubeDao.queryByKeyword as jest.Mock)
      .mockResolvedValueOnce({
        items: [...makeCubes('visible-1', 30, true), ...makeCubes('hidden-1', 6, false)],
        lastKey: 'key-1',
      })
      .mockResolvedValueOnce({ items: makeCubes('visible-2', 36, true), lastKey: 'key-2' });

    const response = await searchMore();

    expect(cubeDao.queryByKeyword).toHaveBeenCalledTimes(2);
    expect((cubeDao.queryByKeyword as jest.Mock).mock.calls[1]![3]).toBe('key-1');
    expect(response.body.cubes).toHaveLength(66);
    expect(response.body.lastKey).toBe('key-2');
  });

  it('stops at three refill iterations', async () => {
    (cubeDao.queryByKeyword as jest.Mock).mockImplementation(async (_keyword, _order, _ascending, cursor) => ({
      items: makeCubes(`hidden-${cursor ?? 'start'}`, 36, false),
      lastKey: `key-after-${cursor ?? 'start'}`,
    }));

    const response = await searchMore();

    expect(cubeDao.queryByKeyword).toHaveBeenCalledTimes(3);
    expect(response.body.cubes).toHaveLength(0);
  });

  it('returns the cursor past everything scanned when the cap trips', async () => {
    (cubeDao.queryByKeyword as jest.Mock)
      .mockResolvedValueOnce({ items: makeCubes('hidden-1', 36, false), lastKey: 'key-1' })
      .mockResolvedValueOnce({ items: makeCubes('hidden-2', 36, false), lastKey: 'key-2' })
      .mockResolvedValueOnce({ items: makeCubes('hidden-3', 36, false), lastKey: 'key-3' });

    const response = await searchMore();

    // Anything less than the final cursor would silently skip every record the refill scanned.
    expect(response.body.lastKey).toBe('key-3');
    expect(response.body.lastKey).not.toBeNull();
  });

  it('stops early when the cursor is exhausted', async () => {
    (cubeDao.queryByKeyword as jest.Mock).mockResolvedValueOnce({
      items: makeCubes('visible-1', 10, true),
      lastKey: undefined,
    });

    const response = await searchMore();

    expect(cubeDao.queryByKeyword).toHaveBeenCalledTimes(1);
    expect(response.body.cubes).toHaveLength(10);
    expect(response.body.lastKey).toBeNull();
  });
});
