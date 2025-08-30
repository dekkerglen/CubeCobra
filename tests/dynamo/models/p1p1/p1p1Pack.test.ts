import P1P1Pack, { UnhydratedP1P1Pack } from '../../../../src/datatypes/P1P1Pack';

const uuid = jest.requireActual('uuid');

// Mock the createClient function to return our mock client
const mockClient = {
  get: jest.fn(),
  query: jest.fn(),
  put: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createTable: jest.fn(),
};

jest.mock('../../../../src/dynamo/util', () => ({
  __esModule: true,
  default: jest.fn(() => mockClient),
}));

// Mock the hydration utility
jest.mock('../../../../src/util/p1p1Util', () => ({
  hydrateP1P1Cards: jest.fn((oracleIds: string[]) => 
    oracleIds.map((oracleId, index) => ({
      scryfall_id: `scryfall-${index + 1}`,
      oracle_id: oracleId,
      name: `Test Card ${index + 1}`,
      full_name: `Test Card ${index + 1}`,
      name_lower: `test card ${index + 1}`,
      set: 'tst',
      collector_number: `${index + 1}`,
      cmc: 1,
      type: 'Creature',
      colors: ['R'],
      color_identity: ['R'],
      colorcategory: 'Red',
      image_normal: `https://example.com/card${index + 1}.jpg`,
      // Add other required CardDetails fields with defaults
      released_at: '2023-01-01',
      isToken: false,
      finishes: ['nonfoil'],
      setIndex: index,
      promo: false,
      reprint: false,
      digital: false,
      artist: 'Test Artist',
      scryfall_uri: 'https://example.com',
      rarity: 'common',
      legalities: {},
      oracle_text: 'Test oracle text',
      parsed_cost: [{ color: 'R', cmc: 1 }],
      border_color: 'black',
      language: 'en',
      mtgo_id: 0,
      layout: 'normal',
      tcgplayer_id: '',
      power: '1',
      toughness: '1',
      loyalty: '',
      error: false,
      full_art: false,
      prices: {},
      tokens: [],
      set_name: 'Test Set',
      produced_mana: [],
      keywords: [],
    }))
  ),
}));

// Import the model after mocking
import p1p1PackModel from '../../../../src/dynamo/models/p1p1Pack';

const createP1P1Pack = (overrides?: Partial<P1P1Pack>): P1P1Pack => ({
  id: uuid.v4(),
  cubeId: uuid.v4(),
  cards: [
    {
      scryfall_id: 'scryfall-1',
      oracle_id: 'oracle-1',
      name: 'Test Card 1',
      full_name: 'Test Card 1',
      name_lower: 'test card 1',
      set: 'tst',
      collector_number: '1',
      cmc: 1,
      type: 'Creature',
      colors: ['R'],
      color_identity: ['R'],
      colorcategory: 'Red',
      image_normal: 'https://example.com/card1.jpg',
    } as any, // Simplified for tests
  ],
  seed: 'test-seed',
  date: Date.now(),
  createdBy: 'test-user',
  createdByUsername: 'testuser',
  votes: [],
  botPick: 0,
  botWeights: [0.8, 0.6, 0.4],
  ...overrides,
});

const createUnhydratedP1P1Pack = (overrides?: Partial<UnhydratedP1P1Pack>): UnhydratedP1P1Pack => ({
  cubeId: uuid.v4(),
  cards: ['oracle-1', 'oracle-2', 'oracle-3'],
  seed: 'test-seed',
  createdBy: 'test-user',
  createdByUsername: 'testuser',
  botPick: 0,
  botWeights: [0.8, 0.6, 0.4],
  ...overrides,
});

describe('P1P1Pack Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('should return pack when found', async () => {
      const packId = uuid.v4();
      const mockItem = {
        id: packId,
        cubeId: uuid.v4(),
        cards: ['oracle-1'],
        seed: 'test-seed',
        date: Date.now(),
        createdBy: 'test-user',
        createdByUsername: 'testuser',
        votesByUser: {
          user1: { userId: 'user1', userName: 'User1', cardIndex: 0, date: Date.now() },
        },
        botPick: 0,
        botWeights: [0.8],
      };

      mockClient.get.mockResolvedValue({
        Item: mockItem,
      });

      const result = await p1p1PackModel.getById(packId);

      expect(mockClient.get).toHaveBeenCalledWith(packId);

      expect(result).toEqual({
        id: packId,
        cubeId: mockItem.cubeId,
        cards: [expect.objectContaining({
          oracle_id: 'oracle-1',
          name: 'Test Card 1',
        })], // Hydrated cards
        seed: mockItem.seed,
        date: mockItem.date,
        createdBy: mockItem.createdBy,
        createdByUsername: mockItem.createdByUsername,
        votes: [{ userId: 'user1', userName: 'User1', cardIndex: 0, date: expect.any(Number) }],
        botPick: 0,
        botWeights: [0.8],
      });
    });

    it('should return undefined when not found', async () => {
      const packId = uuid.v4();

      mockClient.get.mockResolvedValue({
        Item: undefined,
      });

      const result = await p1p1PackModel.getById(packId);

      expect(result).toBeUndefined();
    });
  });

  describe('queryByCube', () => {
    it('should return packs for cube with default limit', async () => {
      const cubeId = uuid.v4();
      const mockItems = [
        {
          id: uuid.v4(),
          date: Date.now(),
          createdBy: 'user1',
          createdByUsername: 'User1',
        },
        {
          id: uuid.v4(),
          date: Date.now() - 1000,
          createdBy: 'user2',
          createdByUsername: 'User2',
        },
      ];

      mockClient.query.mockResolvedValue({
        Items: mockItems,
        LastEvaluatedKey: { id: 'last-key', date: 12345 },
      });

      const result = await p1p1PackModel.queryByCube(cubeId);

      expect(mockClient.query).toHaveBeenCalledWith({
        IndexName: 'ByCube',
        KeyConditionExpression: 'cubeId = :cubeId',
        ExpressionAttributeValues: {
          ':cubeId': cubeId,
        },
        ProjectionExpression: 'id, #date, createdBy, createdByUsername',
        ExpressionAttributeNames: {
          '#date': 'date',
        },
        ExclusiveStartKey: undefined,
        ScanIndexForward: false,
        Limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.lastKey).toEqual({ id: 'last-key', date: 12345 });
    });

    it('should support custom limit and pagination', async () => {
      const cubeId = uuid.v4();
      const lastKey = { id: 'previous-key', date: 67890 };

      mockClient.query.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const result = await p1p1PackModel.queryByCube(cubeId, lastKey, 10);

      expect(mockClient.query).toHaveBeenCalledWith({
        IndexName: 'ByCube',
        KeyConditionExpression: 'cubeId = :cubeId',
        ExpressionAttributeValues: {
          ':cubeId': cubeId,
        },
        ProjectionExpression: 'id, #date, createdBy, createdByUsername',
        ExpressionAttributeNames: {
          '#date': 'date',
        },
        ExclusiveStartKey: lastKey,
        ScanIndexForward: false,
        Limit: 10,
      });

      expect(result.items).toEqual([]);
      expect(result.lastKey).toBeUndefined();
    });
  });

  describe('put', () => {
    it('should create new pack with generated ID and date', async () => {
      const unhydratedPack = createUnhydratedP1P1Pack();

      mockClient.put.mockResolvedValue(undefined);

      const result = await p1p1PackModel.put(unhydratedPack);

      expect(mockClient.put).toHaveBeenCalledWith({
        ...unhydratedPack,
        id: expect.any(String),
        date: expect.any(Number),
        votesByUser: {},
      });

      expect(result).toEqual({
        id: expect.any(String),
        cubeId: unhydratedPack.cubeId,
        cards: [
          expect.objectContaining({ oracle_id: 'oracle-1', name: 'Test Card 1' }),
          expect.objectContaining({ oracle_id: 'oracle-2', name: 'Test Card 2' }),
          expect.objectContaining({ oracle_id: 'oracle-3', name: 'Test Card 3' })
        ], // Hydrated cards
        seed: unhydratedPack.seed,
        date: expect.any(Number),
        createdBy: unhydratedPack.createdBy,
        createdByUsername: unhydratedPack.createdByUsername,
        votes: [],
        botPick: unhydratedPack.botPick,
        botWeights: unhydratedPack.botWeights,
      });
    });

    it('should use provided ID and date if given', async () => {
      const unhydratedPack = createUnhydratedP1P1Pack({
        id: 'existing-id',
        date: 12345,
      });

      mockClient.put.mockResolvedValue(undefined);

      const result = await p1p1PackModel.put(unhydratedPack);

      expect(mockClient.put).toHaveBeenCalledWith({
        ...unhydratedPack,
        id: 'existing-id',
        date: 12345,
        votesByUser: {},
      });

      expect(result.id).toBe('existing-id');
      expect(result.date).toBe(12345);
    });
  });

  describe('deleteById', () => {
    it('should delete pack by ID', async () => {
      const packId = uuid.v4();

      mockClient.delete.mockResolvedValue(undefined);

      await p1p1PackModel.deleteById(packId);

      expect(mockClient.delete).toHaveBeenCalledWith({ id: packId });
    });

    it('should handle delete errors gracefully', async () => {
      const packId = uuid.v4();

      mockClient.delete.mockRejectedValue(new Error('DynamoDB error'));

      await expect(p1p1PackModel.deleteById(packId)).rejects.toThrow('DynamoDB error');
    });
  });

  describe('addVote', () => {
    it('should add vote and return updated pack', async () => {
      const packId = uuid.v4();
      const pack = createP1P1Pack({ id: packId });
      
      // Create database representation (with oracle IDs)
      const dbPack = {
        id: packId,
        cubeId: pack.cubeId,
        cards: ['oracle-1', 'oracle-2', 'oracle-3'], // Raw oracle IDs in DB
        seed: pack.seed,
        date: pack.date,
        createdBy: pack.createdBy,
        createdByUsername: pack.createdByUsername,
        botPick: pack.botPick,
        botWeights: pack.botWeights,
        votesByUser: {
          user1: { userName: 'TestUser', cardIndex: 1, date: expect.any(Number) },
        },
      };

      mockClient.update.mockResolvedValue({
        Attributes: dbPack,
      });

      const result = await p1p1PackModel.addVote(pack, 'user1', 'TestUser', 1);

      expect(mockClient.update).toHaveBeenCalledWith({
        Key: { id: packId },
        UpdateExpression: 'SET #voteMap.#userId = :newVote',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: {
          '#voteMap': 'votesByUser',
          '#userId': 'user1',
        },
        ExpressionAttributeValues: {
          ':newVote': {
            userName: 'TestUser',
            cardIndex: 1,
            date: expect.any(Number),
          },
        },
        ReturnValues: 'ALL_NEW',
      });

      expect(result).toEqual({
        id: packId,
        cubeId: pack.cubeId,
        cards: [
          expect.objectContaining({ oracle_id: 'oracle-1', name: 'Test Card 1' }),
          expect.objectContaining({ oracle_id: 'oracle-2', name: 'Test Card 2' }),
          expect.objectContaining({ oracle_id: 'oracle-3', name: 'Test Card 3' })
        ],
        seed: pack.seed,
        date: pack.date,
        createdBy: pack.createdBy,
        createdByUsername: pack.createdByUsername,
        votes: [{ userId: 'user1', userName: 'TestUser', cardIndex: 1, date: expect.any(Number) }],
        botPick: pack.botPick,
        botWeights: pack.botWeights,
      });
    });

    it('should return null if update returns no attributes', async () => {
      const pack = createP1P1Pack();

      mockClient.update.mockResolvedValue({
        Attributes: undefined,
      });

      const result = await p1p1PackModel.addVote(pack, 'user1', 'TestUser', 1);

      expect(result).toBeNull();
    });

    it('should return null if update fails', async () => {
      const pack = createP1P1Pack();

      mockClient.update.mockRejectedValue(new Error('Update failed'));

      const result = await p1p1PackModel.addVote(pack, 'user1', 'TestUser', 1);

      expect(result).toBeNull();
    });
  });

  describe('getVoteSummary', () => {
    it('should return vote summary with user vote', async () => {
      const pack = createP1P1Pack({
        cards: [
          { oracle_id: 'oracle-1', name: 'Test Card 1' } as any,
          { oracle_id: 'oracle-2', name: 'Test Card 2' } as any,
          { oracle_id: 'oracle-3', name: 'Test Card 3' } as any
        ],
        votes: [
          { userId: 'user1', userName: 'User1', cardIndex: 0, date: Date.now() },
          { userId: 'user2', userName: 'User2', cardIndex: 1, date: Date.now() },
          { userId: 'user3', userName: 'User3', cardIndex: 0, date: Date.now() },
        ],
        botPick: 0,
        botWeights: [0.8, 0.6, 0.4],
      });

      const summary = p1p1PackModel.getVoteSummary(pack, 'user1');

      expect(summary).toEqual({
        totalVotes: 3,
        results: [
          { cardIndex: 0, voteCount: 2, percentage: (2 / 3) * 100 },
          { cardIndex: 1, voteCount: 1, percentage: (1 / 3) * 100 },
          { cardIndex: 2, voteCount: 0, percentage: 0 },
        ],
        userVote: 0,
        botPick: 0,
        botWeights: [0.8, 0.6, 0.4],
      });
    });
  });
});
