jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  packageDao: {
    queryByOracleId: jest.fn(),
    queryByKeyword: jest.fn(),
    queryAllPackages: jest.fn(),
    queryByHashCriteria: jest.fn(),
    queryByMultipleHashes: jest.fn(),
    queryByOwner: jest.fn(),
  },
  userDao: { getByUsername: jest.fn() },
}));

jest.mock('serverutils/carddb', () => ({
  ...jest.requireActual('serverutils/carddb'),
  getMostReasonable: jest.fn(),
  cardFromId: jest.fn(),
}));

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  render: jest.fn(),
  handleRouteError: jest.fn(),
}));

import { DefaultPrintingPreference } from '@utils/datatypes/Card';

import { packageDao, userDao } from '../../src/dynamo/daos';
import { getIndexHandler } from '../../src/router/routes/packages';
import { getMostReasonable } from '../../src/serverutils/carddb';
import { render } from '../../src/serverutils/render';
import { call } from '../test-utils/transport';

const renderedProps = () => (render as jest.Mock).mock.calls[0]![3];

const SUMMON_NAME = 'Summon: Esper Valigarmanda';
const SUMMON_ORACLE = 'oracle-summon-esper';

const search = (q: string) => call(getIndexHandler).withQuery({ q }).withFlash(jest.fn()).send();

describe('package search query parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (packageDao.queryByOracleId as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (packageDao.queryByKeyword as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (packageDao.queryAllPackages as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (packageDao.queryByHashCriteria as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (packageDao.queryByMultipleHashes as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (packageDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    (userDao.getByUsername as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (getMostReasonable as jest.Mock).mockImplementation((name: string) =>
      name === SUMMON_NAME ? { oracle_id: SUMMON_ORACLE, name: SUMMON_NAME } : null,
    );
  });

  it('keeps colons that belong to the card name', async () => {
    await search(`card:"${SUMMON_NAME}"`);

    expect(getMostReasonable).toHaveBeenCalledWith(SUMMON_NAME, DefaultPrintingPreference);
    expect(packageDao.queryByOracleId).toHaveBeenCalledWith(
      SUMMON_ORACLE,
      expect.anything(),
      expect.anything(),
      undefined,
      36,
    );
    expect(renderedProps().parsedQuery).toEqual([`contains ${SUMMON_NAME}`]);
  });

  it('still treats a bare token as a keyword', async () => {
    await search('lands');

    expect(packageDao.queryByKeyword).toHaveBeenCalledWith(
      'lands',
      expect.anything(),
      expect.anything(),
      undefined,
      36,
    );
    expect(renderedProps().parsedQuery).toEqual(['keyword: lands']);
  });

  it('still resolves user queries', async () => {
    await search('user:someone');

    expect(userDao.getByUsername).toHaveBeenCalledWith('someone');
    expect(packageDao.queryByOwner).toHaveBeenCalledWith('user-1', expect.anything(), expect.anything(), undefined, 36);
  });
});
