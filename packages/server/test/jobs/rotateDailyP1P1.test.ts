// Mock all dependencies
jest.mock('serverutils/cubefn', () => ({
  generatePack: jest.fn(),
}));
jest.mock('../../src/dynamo/models/cube');
jest.mock('../../src/dynamo/daos', () => ({
  dailyP1P1Dao: {
    getCurrentDailyP1P1: jest.fn(),
    setActiveDailyP1P1: jest.fn(),
  },
  featuredQueueDao: {
    querySortedByDate: jest.fn(),
  },
  p1p1PackDao: {
    createPack: jest.fn(),
  },
  userDao: {
    getById: jest.fn(),
  },
}));
jest.mock('serverutils/util', () => ({
  addNotification: jest.fn(),
}));

import { generatePack } from 'serverutils/cubefn';
import { rotateDailyP1P1 } from 'serverutils/rotateDailyP1P1';
import { addNotification } from 'serverutils/util';

import { dailyP1P1Dao, featuredQueueDao, p1p1PackDao, userDao } from '../../src/dynamo/daos';
import Cube from '../../src/dynamo/models/cube';

describe('rotateDailyP1P1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // By default, no current daily P1P1 exists
    (dailyP1P1Dao.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(null);
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

      (dailyP1P1Dao.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(existingDailyP1P1);

      const result = await rotateDailyP1P1(generatePack);

      expect(result).toEqual({
        success: true,
        message: 'Daily P1P1 already exists for today',
        dailyP1P1: existingDailyP1P1,
      });
      // Should not create a new pack
      expect(featuredQueueDao.querySortedByDate).not.toHaveBeenCalled();
      expect(p1p1PackDao.createPack).not.toHaveBeenCalled();
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

      (dailyP1P1Dao.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(oldDailyP1P1);
      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generatePack as jest.Mock).mockResolvedValue({
        pack: mockCards,
        seed: 'test-seed',
      });
      (p1p1PackDao.createPack as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Dao.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);

      const result = await rotateDailyP1P1(generatePack);

      // Should create a new pack
      expect(result.success).toBe(true);
      expect(p1p1PackDao.createPack).toHaveBeenCalled();
      expect(dailyP1P1Dao.setActiveDailyP1P1).toHaveBeenCalled();
    });
  });

  describe('error handling - always returns result object', () => {
    it('returns { success: false } when no featured cubes in queue', async () => {
      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [],
      });

      const result = await rotateDailyP1P1(generatePack);

      expect(result).toEqual({
        success: false,
        error: 'No featured cubes in queue',
      });
      expect(Cube.getById).not.toHaveBeenCalled();
    });

    it('returns { success: false } when queue items is null/undefined', async () => {
      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: null,
      });

      const result = await rotateDailyP1P1(generatePack);

      expect(result).toEqual({
        success: false,
        error: 'No featured cubes in queue',
      });
    });

    it('returns { success: false } when selected cube is not found', async () => {
      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(null);

      const result = await rotateDailyP1P1(generatePack);

      expect(result).toEqual({
        success: false,
        error: 'Selected cube not found',
      });
      expect(Cube.getById).toHaveBeenCalledWith('cube-123');
    });

    it('returns { success: false } when an error occurs during pack generation', async () => {
      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue({
        id: 'cube-123',
        name: 'Test Cube',
      });
      (Cube.getCards as jest.Mock).mockResolvedValue([]);
      (generatePack as jest.Mock).mockRejectedValue(new Error('Pack generation failed'));

      const result = await rotateDailyP1P1(generatePack);

      expect(result).toEqual({
        success: false,
        error: 'Pack generation failed',
      });
    });

    it('returns { success: false } when database write fails', async () => {
      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue({
        id: 'cube-123',
        name: 'Test Cube',
      });
      (Cube.getCards as jest.Mock).mockResolvedValue([]);
      (generatePack as jest.Mock).mockResolvedValue({
        pack: [],
        seed: 'test-seed',
      });
      (p1p1PackDao.createPack as jest.Mock).mockRejectedValue(new Error('Database write failed'));

      const result = await rotateDailyP1P1(generatePack);

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

      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generatePack as jest.Mock).mockResolvedValue({
        pack: mockCards,
        seed: 'test-seed-123',
      });
      (p1p1PackDao.createPack as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Dao.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);
      (userDao.getById as jest.Mock).mockImplementation((id) => {
        if (id === 'owner-456') return Promise.resolve(mockOwner);
        if (id === '5d1125b00e0713602c55d967') return Promise.resolve(mockAdmin);
        return Promise.resolve(null);
      });
      (addNotification as jest.Mock).mockResolvedValue(undefined);

      const result = await rotateDailyP1P1(generatePack);

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

      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generatePack as jest.Mock).mockResolvedValue({
        pack: mockCards,
        seed: 'test-seed',
      });
      (p1p1PackDao.createPack as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Dao.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);
      (userDao.getById as jest.Mock).mockRejectedValue(new Error('User fetch failed'));

      const result = await rotateDailyP1P1(generatePack);

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

      (featuredQueueDao.querySortedByDate as jest.Mock).mockResolvedValue({
        items: [{ cube: 'cube-123' }],
      });
      (Cube.getById as jest.Mock).mockResolvedValue(mockCube);
      (Cube.getCards as jest.Mock).mockResolvedValue(mockCards);
      (generatePack as jest.Mock).mockResolvedValue({
        pack: mockCards,
        seed: 'test-seed',
      });
      (p1p1PackDao.createPack as jest.Mock).mockResolvedValue(mockPack);
      (dailyP1P1Dao.setActiveDailyP1P1 as jest.Mock).mockResolvedValue(mockDailyP1P1);

      const result = await rotateDailyP1P1(generatePack);

      expect(result).toEqual({
        success: true,
        pack: mockPack,
        cube: mockCube,
        dailyP1P1: mockDailyP1P1,
      });
      expect(userDao.getById).not.toHaveBeenCalled();
      expect(addNotification).not.toHaveBeenCalled();
    });
  });
});
