import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import History, { Period, UnhydratedCardHistory } from '@utils/datatypes/History';

import { CardHistoryDynamoDao } from '../../src/dynamo/dao/CardHistoryDynamoDao';

// Mock the DynamoDB client
const mockSend = jest.fn();
const mockDynamoDBClient = {
  send: mockSend,
} as unknown as DynamoDBDocumentClient;

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
  dateCreated: Date.now(),
  dateLastUpdated: Date.now(),
  ...overrides,
});

describe('CardHistoryDynamoDao', () => {
  let cardHistoryDao: CardHistoryDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create DAO instance with disabled dual write for testing
    cardHistoryDao = new CardHistoryDynamoDao(mockDynamoDBClient, 'test-table', false);
    mockSend.mockReset();
  });

  describe('queryByOracleAndType', () => {
    it('returns empty result when no history found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      const result = await cardHistoryDao.queryByOracleAndType('oracle-123', Period.DAY, 5);

      expect(result).toEqual({ items: [], lastKey: undefined });
      expect(mockSend).toHaveBeenCalled();
    });

    it('returns hydrated history items with last key', async () => {
      const history1 = createUnhydratedCardHistory({ date: 1000 });
      const history2 = createUnhydratedCardHistory({ date: 2000 });

      mockSend.mockResolvedValueOnce({
        Items: [{ item: history1 }, { item: history2 }],
        LastEvaluatedKey: { PK: 'lastKey' },
      });

      const result = await cardHistoryDao.queryByOracleAndType('oracle-123', Period.DAY, 10);

      expect(result.items?.length).toBe(2);
      expect(result.items?.[0]?.cubes).toBeDefined(); // Check hydration
      expect(result.lastKey).toEqual({ PK: 'lastKey' });
      expect(mockSend).toHaveBeenCalled();
    });

    it('uses default limit of 100', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      await cardHistoryDao.queryByOracleAndType('oracle-123', Period.DAY);

      expect(mockSend).toHaveBeenCalled();
      const callArgs = mockSend.mock.calls[0][0].input;
      expect(callArgs.Limit).toBe(100);
    });

    it('uses provided last key for pagination', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      const lastKey = { PK: 'previousPage', SK: 'sortKey' };
      await cardHistoryDao.queryByOracleAndType('oracle-123', Period.DAY, 5, lastKey);

      expect(mockSend).toHaveBeenCalled();
      const callArgs = mockSend.mock.calls[0][0].input;
      expect(callArgs.ExclusiveStartKey).toEqual(lastKey);
    });
  });

  describe('queryByOracle', () => {
    it('returns empty result when no history found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      const result = await cardHistoryDao.queryByOracle('oracle-123');

      expect(result).toEqual({ items: [], lastKey: undefined });
    });

    it('returns hydrated history items across all periods', async () => {
      const history1 = createUnhydratedCardHistory({ OTComp: 'oracle-123:day', date: 1000 });
      const history2 = createUnhydratedCardHistory({ OTComp: 'oracle-123:week', date: 2000 });

      mockSend.mockResolvedValueOnce({
        Items: [{ item: history1 }, { item: history2 }],
        LastEvaluatedKey: undefined,
      });

      const result = await cardHistoryDao.queryByOracle('oracle-123');

      expect(result.items?.length).toBe(2);
      expect(result.items?.[0]?.cubes).toBeDefined(); // Check hydration
    });
  });

  describe('queryByDateRange', () => {
    it('returns items within date range', async () => {
      const history1 = createUnhydratedCardHistory({ date: 1000 });

      mockSend.mockResolvedValueOnce({
        Items: [{ item: history1 }],
        LastEvaluatedKey: undefined,
      });

      const result = await cardHistoryDao.queryByDateRange(1000, 2000);

      expect(result.items?.length).toBe(1);
      expect(result.items?.[0]?.cubes).toBeDefined(); // Check hydration
    });

    it('handles open-ended date range', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      await cardHistoryDao.queryByDateRange(1000);

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('put', () => {
    it('saves card history document', async () => {
      const history: History = {
        ...createUnhydratedCardHistory(),
        cubes: 83,
      };
      mockSend.mockResolvedValueOnce({});

      await cardHistoryDao.put(history);

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('batchPut', () => {
    it('saves multiple card history documents', async () => {
      const histories: History[] = [
        { ...createUnhydratedCardHistory({ date: 1000 }), cubes: 83 },
        { ...createUnhydratedCardHistory({ date: 2000 }), cubes: 83 },
      ];
      mockSend.mockResolvedValue({});

      await cardHistoryDao.batchPut(histories);

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('hydration', () => {
    it('correctly calculates cubes from cube type data', async () => {
      const unhydrated = createUnhydratedCardHistory({
        legacy: [50, 75],
        modern: [33, 45],
        pauper: [10, 15],
        // Other types are [0, 0] or undefined
      });

      mockSend.mockResolvedValueOnce({
        Items: [{ item: unhydrated }],
        LastEvaluatedKey: undefined,
      });

      const result = await cardHistoryDao.queryByOracleAndType('oracle-123', Period.DAY);

      expect(result.items?.length).toBe(1);
      expect(result.items?.[0]?.cubes).toBe(93); // 50 + 33 + 10
    });
  });
});
