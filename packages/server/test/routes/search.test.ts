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
import { render } from '../../src/serverutils/render';
import { call } from '../test-utils/transport';
const searchHandler = routes.find((route) => route.path === '')!.handler.at(-1)!;

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
