import { P1P1Pack, P1P1PackDynamoData, P1P1PackS3Data } from '../../@utils/datatypes/P1P1Pack';

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

// Mock S3 client
const mockGetObject = jest.fn();
const mockPutObject = jest.fn();
const mockDeleteObject = jest.fn();
const mockGetBucketName = jest.fn(() => 'test-bucket');

jest.mock('../../../../src/dynamo/s3client', () => ({
  getObject: mockGetObject,
  putObject: mockPutObject,
  deleteObject: mockDeleteObject,
  getBucketName: mockGetBucketName,
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
  votesByUser: {},
  botPick: 0,
  botWeights: [0.8, 0.6, 0.4],
  ...overrides,
});

const createDynamoData = (overrides?: Partial<P1P1PackDynamoData>): P1P1PackDynamoData => ({
  id: uuid.v4(),
  cubeId: uuid.v4(),
  createdBy: 'test-user',
  date: Date.now(),
  votesByUser: {},
  ...overrides,
});

const createS3Data = (overrides?: Partial<P1P1PackS3Data>): P1P1PackS3Data => ({
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
  createdByUsername: 'testuser',
  botPick: 0,
  botWeights: [0.8, 0.6, 0.4],
  ...overrides,
});

describe('p1p1Pack Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('should return hydrated pack when found', async () => {
      const packId = uuid.v4();
      const dynamoPack = createDynamoData({ id: packId });
      const s3Data = createS3Data();

      mockClient.get.mockResolvedValue({ Item: dynamoPack });
      mockGetObject.mockResolvedValue(s3Data);

      const result = await p1p1PackModel.getById(packId);

      expect(mockClient.get).toHaveBeenCalledWith(packId);
      expect(mockGetObject).toHaveBeenCalledWith('test-bucket', `p1p1-packs/${packId}.json`);
      expect(result).toEqual({
        ...dynamoPack,
        ...s3Data,
      });
    });

    it('should return null when pack not found', async () => {
      const packId = uuid.v4();

      mockClient.get.mockResolvedValue({});

      const result = await p1p1PackModel.getById(packId);

      expect(result).toBeNull();
    });

    it('should return null when S3 data not found', async () => {
      const packId = uuid.v4();
      const dynamoPack = createDynamoData({ id: packId });

      mockClient.get.mockResolvedValue({ Item: dynamoPack });
      mockGetObject.mockResolvedValue(null);

      const result = await p1p1PackModel.getById(packId);

      expect(result).toBeNull();
    });
  });

  describe('put', () => {
    it('should create new pack with generated ID and date', async () => {
      const dynamoPackData = {
        cubeId: uuid.v4(),
        createdBy: 'test-user',
      };
      const s3Data = createS3Data();

      mockClient.put.mockResolvedValue(undefined);
      mockPutObject.mockResolvedValue(undefined);

      const result = await p1p1PackModel.put(dynamoPackData, s3Data);

      expect(mockClient.put).toHaveBeenCalledWith({
        ...dynamoPackData,
        id: expect.any(String),
        date: expect.any(Number),
        votesByUser: {},
      });

      expect(mockPutObject).toHaveBeenCalledWith(
        'test-bucket',
        expect.stringMatching(/^p1p1-packs\/.*\.json$/),
        s3Data,
      );

      expect(result).toEqual({
        id: expect.any(String),
        cubeId: dynamoPackData.cubeId,
        date: expect.any(Number),
        createdBy: dynamoPackData.createdBy,
        votesByUser: {},
        ...s3Data,
      });
    });
  });

  describe('deleteById', () => {
    it('should delete from both DynamoDB and S3', async () => {
      const packId = uuid.v4();

      mockClient.delete.mockResolvedValue(undefined);
      mockDeleteObject.mockResolvedValue(undefined);

      await p1p1PackModel.deleteById(packId);

      expect(mockClient.delete).toHaveBeenCalledWith({ id: packId });
      expect(mockDeleteObject).toHaveBeenCalledWith('test-bucket', `p1p1-packs/${packId}.json`);
    });

    it('should not fail if S3 deletion fails', async () => {
      const packId = uuid.v4();

      mockClient.delete.mockResolvedValue(undefined);
      mockDeleteObject.mockRejectedValue(new Error('S3 error'));

      // Should not throw
      await expect(p1p1PackModel.deleteById(packId)).resolves.toBeUndefined();

      expect(mockClient.delete).toHaveBeenCalledWith({ id: packId });
      expect(mockDeleteObject).toHaveBeenCalledWith('test-bucket', `p1p1-packs/${packId}.json`);
    });
  });

  describe('addVote', () => {
    it('should add vote and return updated pack', async () => {
      const pack = createP1P1Pack();
      const userId = 'user1';
      const cardIndex = 1;

      const updatedAttributes = {
        ...pack,
        votesByUser: { [userId]: cardIndex },
      };

      mockClient.update.mockResolvedValue({ Attributes: updatedAttributes });
      mockGetObject.mockResolvedValue({
        cards: pack.cards,
        seed: pack.seed,
        createdByUsername: pack.createdByUsername,
        botPick: pack.botPick,
        botWeights: pack.botWeights,
      });

      const result = await p1p1PackModel.addVote(pack, userId, cardIndex);

      expect(mockClient.update).toHaveBeenCalledWith({
        Key: { id: pack.id },
        UpdateExpression: 'SET #voteMap.#userId = :cardIndex',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: {
          '#voteMap': 'votesByUser',
          '#userId': userId,
        },
        ExpressionAttributeValues: {
          ':cardIndex': cardIndex,
        },
        ReturnValues: 'ALL_NEW',
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: pack.id,
          votesByUser: { [userId]: cardIndex },
        }),
      );
    });
  });

  describe('getVoteSummary', () => {
    it('should return vote summary with correct counts', async () => {
      const pack = createP1P1Pack({
        votesByUser: {
          user1: 0,
          user2: 1,
          user3: 0,
        },
        cards: [{ name: 'Card 1' } as any, { name: 'Card 2' } as any],
      });

      const summary = p1p1PackModel.getVoteSummary(pack, 'user1');

      expect(summary).toEqual({
        totalVotes: 3,
        results: [
          { cardIndex: 0, voteCount: 2, percentage: 66.66666666666666 },
          { cardIndex: 1, voteCount: 1, percentage: 33.33333333333333 },
        ],
        userVote: 0,
        botPick: 0,
        botWeights: [0.8, 0.6, 0.4],
      });
    });

    it('should handle empty votes', async () => {
      const pack = createP1P1Pack({
        votesByUser: {},
        cards: [{ name: 'Card 1' } as any, { name: 'Card 2' } as any],
      });

      const summary = p1p1PackModel.getVoteSummary(pack);

      expect(summary).toEqual({
        totalVotes: 0,
        results: [
          { cardIndex: 0, voteCount: 0, percentage: 0 },
          { cardIndex: 1, voteCount: 0, percentage: 0 },
        ],
        userVote: undefined,
        botPick: 0,
        botWeights: [0.8, 0.6, 0.4],
      });
    });
  });
});
