import { Catalog } from '@utils/datatypes/CardCatalog';

const mockCardCatalog: Catalog = {
  imagedict: {},
  cardimages: {},
  cardnames: ['angel token', 'lightning bolt', 'treasure token'],
  comboTree: {},
  full_names: ['angel token [TKHM-1]', 'lightning bolt [2XM-117]', 'treasure token [TKHM-2]'],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
  oracleToIndex: {},
  metadatadict: {},
  printedCardList: [],
  printedCardListWithExtras: [],
  comboOracleToIndex: {},
  reasonable_names: ['lightning bolt'],
  reasonable_full_names: ['lightning bolt [2XM-117]'],
  setdict: {},
};

jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: mockCardCatalog,
}));

import { Request, Response } from 'express';
import { cardNamesHandler } from 'router/routes/tool/api/cardnames';

const createMockReq = (query: Record<string, string>) =>
  ({
    query,
    logger: { error: jest.fn() },
  }) as unknown as Request;

const createMockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

describe('cardNamesHandler', () => {
  it('returns filtered results by default (no extras param)', async () => {
    const req = createMockReq({ q: 'lig' });
    const res = createMockRes();
    await cardNamesHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      names: ['lightning bolt'],
    });
  });

  it('excludes tokens from results when extras=0', async () => {
    const req = createMockReq({ q: 'angel', extras: '0' });
    const res = createMockRes();
    await cardNamesHandler(req, res);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      names: [],
    });
  });

  it('includes tokens when extras=1', async () => {
    const req = createMockReq({ q: 'angel', extras: '1' });
    const res = createMockRes();
    await cardNamesHandler(req, res);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      names: ['angel token'],
    });
  });

  it('uses reasonable_full_names when full=1 and extras not set', async () => {
    const req = createMockReq({ q: 'lig', full: '1' });
    const res = createMockRes();
    await cardNamesHandler(req, res);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      names: ['lightning bolt [2XM-117]'],
    });
  });

  it('uses full_names when full=1 and extras=1', async () => {
    const req = createMockReq({ q: 'angel', full: '1', extras: '1' });
    const res = createMockRes();
    await cardNamesHandler(req, res);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      names: ['angel token [TKHM-1]'],
    });
  });
});
