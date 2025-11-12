import { Period, UnhydratedCardHistory } from '@utils/datatypes/History';
import CardHistory from '../../src/dynamo/models/cardhistory';

// Mock dependencies
jest.mock('../../src/dynamo/util');

// Test helpers
const createUnhydratedCardHistory = (overrides?: Partial<UnhydratedCardHistory>): UnhydratedCardHistory => ({
  OTComp: 'oracle-123:day',
  oracle: 'oracle-123',
  date: new Date('2024-03-24').valueOf(),
  picks: 10,
  elo: 1201,
  size180: undefined,
  size360: [0, 0],
  size450: [0, 0],
  size540: [0, 0],
  size720: [0, 0],
  pauper: [0, 0],
  peasant: [0, 0],
  legacy: [50, 75],
  modern: [33, 45],
  vintage: [0, 0],
  cubeCount: undefined,
  total: [83, 120],
  ...overrides,
});

const setupQueryResult = (response: any) => {
  (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce(response);
};

const verifyQueryCall = (params: any) => {
  expect(mockDynamoClient.query).toHaveBeenCalledWith(expect.objectContaining(params));
};

// First test createClient configuration
describe('CardHistory Model Initialization', () => {
  it('cardhistory table created with proper configuration', async () => {
    // Import to trigger createClient
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/dynamo/models/cardhistory');

    expect(mockDynamoCreateClient).toHaveBeenCalledWith({
      name: 'CARD_HISTORY',
      partitionKey: 'OTComp',
      sortKey: 'date',
      attributes: {
        OTComp: 'S',
        date: 'N',
      },
    });
  });
});

describe('CardHistory Model', () => {
  const mockCardHistory = createUnhydratedCardHistory();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('getByOracleAndType', () => {
    it('returns empty result when no history found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });

      const result = await CardHistory.getByOracleAndType('oracle-123', Period.DAY, 5);

      expect(result).toEqual({ items: [], lastKey: null });
      verifyQueryCall({
        KeyConditionExpression: 'OTComp = :oracle',
        ExpressionAttributeValues: {
          ':oracle': 'oracle-123:day',
        },
        ScanIndexForward: false,
        Limit: 5,
      });
    });

    it('returns history items with last key', async () => {
      const history1 = createUnhydratedCardHistory({ date: 1000 });
      const history2 = createUnhydratedCardHistory({ date: 2000 });

      setupQueryResult({
        Items: [history1, history2],
        LastEvaluatedKey: { key: 'lastKey' },
      });

      const result = await CardHistory.getByOracleAndType('oracle-123', Period.DAY, 10);

      expect(result.items).toEqual([history1, history2]);
      expect(result.lastKey).toEqual({ key: 'lastKey' });
      verifyQueryCall({
        KeyConditionExpression: 'OTComp = :oracle',
        ExpressionAttributeValues: {
          ':oracle': 'oracle-123:day',
        },
        ScanIndexForward: false,
        Limit: 10,
      });
    });

    it('uses default limit when limit is falsey', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });

      await CardHistory.getByOracleAndType('oracle-123', Period.DAY, 0);

      verifyQueryCall({
        Limit: 100,
      });
    });

    it('uses provided last key for pagination', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });

      const lastKey = { S: 'previousPage' };
      await CardHistory.getByOracleAndType('oracle-123', Period.DAY, 5, lastKey);

      verifyQueryCall({
        ExclusiveStartKey: lastKey,
      });
    });
  });

  describe('put', () => {
    it('saves card history document', async () => {
      await CardHistory.put(mockCardHistory);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(mockCardHistory);
    });
  });

  describe('batchPut', () => {
    it('saves multiple card history documents', async () => {
      const histories = [createUnhydratedCardHistory({ date: 1000 }), createUnhydratedCardHistory({ date: 2000 })];

      await CardHistory.batchPut(histories);

      expect(mockDynamoClient.batchPut).toHaveBeenCalledWith(histories);
    });
  });

  describe('createTable', () => {
    it('calls client to create table', async () => {
      await CardHistory.createTable();

      expect(mockDynamoClient.createTable).toHaveBeenCalled();
    });
  });
});
