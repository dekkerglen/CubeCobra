import rotateDailyP1P1 from '../../src/jobs/rotateDailyP1P1';

// Mock all dependencies
jest.mock('../../src/util/cubefn', () => ({
  generateBalancedPack: jest.fn(),
}));
jest.mock('../../src/util/ml', () => ({
  ensureModelsReady: jest.fn(),
}));
jest.mock('../../src/util/cardCatalog', () => ({
  initializeCardDb: jest.fn(),
}));
jest.mock('../../src/dynamo/models/cube');
jest.mock('../../src/dynamo/models/p1p1Pack');
jest.mock('../../src/dynamo/models/dailyP1P1');
jest.mock('../../src/dynamo/models/featuredQueue', () => ({
  querySortedByDate: jest.fn(),
}));
jest.mock('../../src/dynamo/models/user');
jest.mock('../../src/util/util', () => ({
  addNotification: jest.fn(),
}));

import { generateBalancedPack } from '../../src/util/cubefn';
import { ensureModelsReady } from '../../src/util/ml';
import { initializeCardDb } from '../../src/util/cardCatalog';
import Cube from '../../src/dynamo/models/cube';
import p1p1PackModel from '../../src/dynamo/models/p1p1Pack';
import dailyP1P1Model from '../../src/dynamo/models/dailyP1P1';
import User from '../../src/dynamo/models/user';
import { addNotification } from '../../src/util/util';

const FeaturedQueue = require('../../src/dynamo/models/featuredQueue');

describe('rotateDailyP1P1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default successful mocks
    (initializeCardDb as jest.Mock).mockResolvedValue(undefined);
    (ensureModelsReady as jest.Mock).mockResolvedValue(undefined);
    // By default, no current daily P1P1 exists
    (dailyP1P1Model.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(null);
  });

  describe('idempotency checks', () => {
    it('returns success without creating new pack if daily P1P1 already exists for today', async () => {
      const existingDailyP1P1 = {
        id: 'existing-daily-p1p1',
        packId: 'existing-pack',
        cubeId: 'existing-cube',
        date: Date.now(), // Created just now
        isActive: true,
      };

      (dailyP1P1Model.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(existingDailyP1P1);

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: true,
        message: 'Daily P1P1 already exists for today',
        dailyP1P1: existingDailyP1P1,
      });
      // Should not create a new pack
      expect(FeaturedQueue.querySortedByDate).not.toHaveBeenCalled();
      expect(p1p1PackModel.put).not.toHaveBeenCalled();
    });

    it('creates new pack if existing daily P1P1 is older than 23 hours', async () => {
      const oldDailyP1P1 = {
        id: 'old-daily-p1p1',
        packId: 'old-pack',
        cubeId: 'old-cube',
        date: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
        isActive: true,
      };
      const mockCube = {
        id: 'cube-123',
        name: 'Test Cube',
      };
      const mockCards = [{ id: 'card-1' }];
      const mockPack = {
        id: 'pack-789',
        cubeId: 'cube-123',
      };
      const mockDailyP1P1 = {
        id: 'daily-p1p1-abc',
        packId: 'pack-789',
      };

      (dailyP1P1Model.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(oldDailyP1P1);
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generateBalancedPack as jest.Mock).mockResolvedValue({
        packResult: { pack: mockCards },
        botResult: { botPickIndex: 0, botWeights: [] },
        maxBotWeight: 0.5,
        seed: 'test-seed',
        allCandidates: [{ maxBotWeight: 0.5 }],
      });
      (p1p1PackModel.put as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Model.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);

      const result = await rotateDailyP1P1();

      // Should create a new pack
      expect(result.success).toBe(true);
      expect(p1p1PackModel.put).toHaveBeenCalled();
      expect(dailyP1P1Model.setActiveDailyP1P1).toHaveBeenCalled();
    });
  });

  describe('error handling - always returns result object', () => {
    it('returns { success: false } when no featured cubes in queue', async () => {
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [],
      });

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: false,
        error: 'No featured cubes in queue',
      });
      expect(Cube.getById).not.toHaveBeenCalled();
    });

    it('returns { success: false } when queue items is null/undefined', async () => {
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: null,
      });

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: false,
        error: 'No featured cubes in queue',
      });
    });

    it('returns { success: false } when selected cube is not found', async () => {
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(null);

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: false,
        error: 'Selected cube not found',
      });
      expect(Cube.getById).toHaveBeenCalledWith('cube-123');
    });

    it('returns { success: false } when an error occurs during pack generation', async () => {
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue({
        id: 'cube-123',
        name: 'Test Cube',
      });
      (Cube.getCards as jest.Mock).mockResolvedValue([]);
      (generateBalancedPack as jest.Mock).mockRejectedValue(new Error('Pack generation failed'));

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: false,
        error: 'Pack generation failed',
      });
    });

    it('returns { success: false } when database write fails', async () => {
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue({
        id: 'cube-123',
        name: 'Test Cube',
      });
      (Cube.getCards as jest.Mock).mockResolvedValue([]);
      (generateBalancedPack as jest.Mock).mockResolvedValue({
        packResult: { pack: [] },
        botResult: { botPickIndex: 0, botWeights: [] },
        maxBotWeight: 0.5,
        seed: 'test-seed',
        allCandidates: [{ maxBotWeight: 0.5 }],
      });
      (p1p1PackModel.put as jest.Mock).mockRejectedValue(new Error('Database write failed'));

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: false,
        error: 'Database write failed',
      });
    });
  });

  describe('successful rotation', () => {
    it('returns { success: true } with pack, cube, and dailyP1P1 data on success', async () => {
      const mockCube = {
        id: 'cube-123',
        name: 'Test Cube',
        owner: 'owner-456',
      };
      const mockCards = [{ id: 'card-1' }, { id: 'card-2' }];
      const mockPack = {
        id: 'pack-789',
        cubeId: 'cube-123',
        createdBy: 'CubeCobra',
      };
      const mockDailyP1P1 = {
        id: 'daily-p1p1-abc',
        packId: 'pack-789',
        cubeId: 'cube-123',
      };
      const mockOwner = {
        id: 'owner-456',
        username: 'testowner',
      };
      const mockAdmin = {
        id: '5d1125b00e0713602c55d967',
        username: 'admin',
      };

      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generateBalancedPack as jest.Mock).mockResolvedValue({
        packResult: { pack: mockCards },
        botResult: { botPickIndex: 0, botWeights: [0.5, 0.3] },
        maxBotWeight: 0.5,
        seed: 'test-seed-123',
        allCandidates: [{ maxBotWeight: 0.5 }],
      });
      (p1p1PackModel.put as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Model.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);
      (User.getById as jest.Mock).mockImplementation((id) => {
        if (id === 'owner-456') return Promise.resolve(mockOwner);
        if (id === '5d1125b00e0713602c55d967') return Promise.resolve(mockAdmin);
        return Promise.resolve(null);
      });
      (addNotification as jest.Mock).mockResolvedValue(undefined);

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: true,
        pack: mockPack,
        cube: mockCube,
        dailyP1P1: mockDailyP1P1,
      });
      expect(addNotification).toHaveBeenCalledWith(
        mockOwner,
        mockAdmin,
        `/tool/p1p1/${mockPack.id}`,
        `Your cube "${mockCube.name}" is featured on today's Daily Pack 1 Pick 1!`,
      );
    });

    it('returns { success: true } when notification fails but pack creation succeeds', async () => {
      const mockCube = {
        id: 'cube-123',
        name: 'Test Cube',
        owner: 'owner-456',
      };
      const mockCards = [{ id: 'card-1' }];
      const mockPack = {
        id: 'pack-789',
        cubeId: 'cube-123',
      };
      const mockDailyP1P1 = {
        id: 'daily-p1p1-abc',
        packId: 'pack-789',
      };

      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generateBalancedPack as jest.Mock).mockResolvedValue({
        packResult: { pack: mockCards },
        botResult: { botPickIndex: 0, botWeights: [] },
        maxBotWeight: 0.5,
        seed: 'test-seed',
        allCandidates: [{ maxBotWeight: 0.5 }],
      });
      (p1p1PackModel.put as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Model.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);
      (User.getById as jest.Mock).mockRejectedValue(new Error('User fetch failed'));

      const result = await rotateDailyP1P1();

      // Should still return success even if notification fails
      expect(result).toEqual({
        success: true,
        pack: mockPack,
        cube: mockCube,
        dailyP1P1: mockDailyP1P1,
      });
    });

    it('returns { success: true } and skips notification when no owner ID found', async () => {
      const mockCube = {
        id: 'cube-123',
        name: 'Test Cube',
        owner: undefined, // No owner
      };
      const mockCards = [{ id: 'card-1' }];
      const mockPack = {
        id: 'pack-789',
        cubeId: 'cube-123',
      };
      const mockDailyP1P1 = {
        id: 'daily-p1p1-abc',
        packId: 'pack-789',
      };

      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generateBalancedPack as jest.Mock).mockResolvedValue({
        packResult: { pack: mockCards },
        botResult: { botPickIndex: 0, botWeights: [] },
        maxBotWeight: 0.5,
        seed: 'test-seed',
        allCandidates: [{ maxBotWeight: 0.5 }],
      });
      (p1p1PackModel.put as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Model.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);

      const result = await rotateDailyP1P1();

      expect(result).toEqual({
        success: true,
        pack: mockPack,
        cube: mockCube,
        dailyP1P1: mockDailyP1P1,
      });
      expect(User.getById).not.toHaveBeenCalled();
      expect(addNotification).not.toHaveBeenCalled();
    });
  });

  describe('initialization', () => {
    it('initializes card database and ML models', async () => {
      (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue({
        id: 'cube-123',
        name: 'Test Cube',
      });
      (Cube.getCards as jest.Mock).mockResolvedValue([]);
      (generateBalancedPack as jest.Mock).mockResolvedValue({
        packResult: { pack: [] },
        botResult: { botPickIndex: 0, botWeights: [] },
        maxBotWeight: 0.5,
        seed: 'test-seed',
        allCandidates: [{ maxBotWeight: 0.5 }],
      });
      (p1p1PackModel.put as jest.Mock).mockResolvedValue({ id: 'pack-123' });
      (dailyP1P1Model.setActiveDailyP1P1 as jest.Mock).mockResolvedValue({ id: 'daily-123' });

      await rotateDailyP1P1();

      expect(initializeCardDb).toHaveBeenCalled();
      expect(ensureModelsReady).toHaveBeenCalled();
    });
  });
});
