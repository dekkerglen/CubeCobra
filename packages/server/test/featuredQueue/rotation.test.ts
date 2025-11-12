 
const { rotateFeatured } = require('serverutils/featuredQueue');
 
const FeaturedQueue = require('../../src/dynamo/models/featuredQueue');
 
const Patron = require('../../src/dynamo/models/patron');
import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';

// Mock dependencies
jest.mock('../../src/dynamo/models/featuredQueue');
jest.mock('../../src/dynamo/models/patron');

describe('Featured Queue Rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockQueueData = (items: any[]) => {
    (FeaturedQueue.querySortedByDate as jest.Mock).mockResolvedValueOnce({ items, lastKey: null });
  };

  const createPatron = (status: string, level: number) => ({
    status,
    level,
  });

  const createCube = (id: string, owner: string, date: number) => ({
    cube: id,
    owner,
    date,
  });

  it('should not rotate if queue has less than 4 cubes', async () => {
    const queue = [createCube('cube1', 'user1', Date.now() - 2000), createCube('cube2', 'user2', Date.now() - 1000)];

    mockQueueData(queue);

    const result = await rotateFeatured();

    expect(result.success).toBe('false');
    expect(result.messages).toContain('Not enough cubes in queue to rotate (need 4, have 2)');
    expect(result.removed).toEqual([]);
    expect(result.added).toEqual([]);
  });

  it('should successfully rotate featured cubes when all patrons are eligible', async () => {
    const queue = [
      createCube('cube1', 'user1', Date.now() - 4000),
      createCube('cube2', 'user2', Date.now() - 3000),
      createCube('cube3', 'user3', Date.now() - 2000),
      createCube('cube4', 'user4', Date.now() - 1000),
    ];

    mockQueueData(queue);

    // Mock all patrons as eligible
    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    (Patron.getById as jest.Mock).mockResolvedValue(activePatron);
    (FeaturedQueue.put as jest.Mock).mockResolvedValue({});
    (FeaturedQueue.delete as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('true');
    expect(result.removed).toEqual([]); // No cubes removed due to patron status
    expect(result.added).toHaveLength(2);
    expect(result.added[0].cube).toBe('cube3');
    expect(result.added[1].cube).toBe('cube4');

    // Verify old cubes (first 2) were moved to back with updated date
    expect(FeaturedQueue.put).toHaveBeenCalledWith(
      expect.objectContaining({
        cube: 'cube1',
        date: expect.any(Number),
      }),
    );
    expect(FeaturedQueue.put).toHaveBeenCalledWith(
      expect.objectContaining({
        cube: 'cube2',
        date: expect.any(Number),
      }),
    );
  });

  it('should remove cubes with ineligible patrons before rotation', async () => {
    const queue = [
      createCube('cube1', 'user1', Date.now() - 6000),
      createCube('cube2', 'user2', Date.now() - 5000),
      createCube('cube3', 'user3', Date.now() - 4000),
      createCube('cube4', 'user4', Date.now() - 3000),
      createCube('cube5', 'user5', Date.now() - 2000),
      createCube('cube6', 'user6', Date.now() - 1000),
    ];

    mockQueueData(queue);

    // Mock patrons: user3 and user5 are ineligible
    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    const inactivePatron = createPatron(PatronStatuses.INACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    const lowLevelPatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling']);

    (Patron.getById as jest.Mock).mockImplementation((userId: string) => {
      if (userId === 'user3') return Promise.resolve(inactivePatron);
      if (userId === 'user5') return Promise.resolve(lowLevelPatron);
      return Promise.resolve(activePatron);
    });

    (FeaturedQueue.put as jest.Mock).mockResolvedValue({});
    (FeaturedQueue.delete as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('true');
    expect(result.removed).toHaveLength(2);
    expect(result.removed.find((c: any) => c.cube === 'cube3')).toBeTruthy();
    expect(result.removed.find((c: any) => c.cube === 'cube5')).toBeTruthy();
    expect(result.messages).toContain('Removed 2 cubes due to patron status');

    // Verify ineligible cubes were deleted
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube3');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube5');

    // Verify rotation happened with remaining eligible cubes
    expect(result.added).toHaveLength(2);
    expect(result.added[0].cube).toBe('cube4');
    expect(result.added[1].cube).toBe('cube6');
  });

  it('should handle case where currently featured cubes become ineligible', async () => {
    const queue = [
      createCube('cube1', 'user1', Date.now() - 5000),
      createCube('cube2', 'user2', Date.now() - 4000),
      createCube('cube3', 'user3', Date.now() - 3000),
      createCube('cube4', 'user4', Date.now() - 2000),
      createCube('cube5', 'user5', Date.now() - 1000),
    ];

    mockQueueData(queue);

    // Mock patrons: user1 (first featured cube) is now ineligible
    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    const expiredPatron = createPatron(PatronStatuses.INACTIVE, PatronLevels['Cobra Hatchling'] + 1);

    (Patron.getById as jest.Mock).mockImplementation((userId: string) => {
      if (userId === 'user1') return Promise.resolve(expiredPatron);
      return Promise.resolve(activePatron);
    });

    (FeaturedQueue.put as jest.Mock).mockResolvedValue({});
    (FeaturedQueue.delete as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('true');
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].cube).toBe('cube1');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube1');

    // Verify rotation still happened with remaining cubes
    // After removing cube1, the queue is [cube2, cube3, cube4, cube5]
    // First 2 are cube2 and cube3, so rotation moves them to back
    // New featured cubes are cube4 and cube5
    expect(result.added).toHaveLength(2);
    expect(result.added[0].cube).toBe('cube4');
    expect(result.added[1].cube).toBe('cube5');

    // Verify cube2 (first cube after removal) was moved to back
    expect(FeaturedQueue.put).toHaveBeenCalledWith(
      expect.objectContaining({
        cube: 'cube2',
        date: expect.any(Number),
      }),
    );
    // Verify cube3 (second cube after removal) was also moved to back
    expect(FeaturedQueue.put).toHaveBeenCalledWith(
      expect.objectContaining({
        cube: 'cube3',
        date: expect.any(Number),
      }),
    );
  });

  it('should return error if not enough cubes remain after patron check', async () => {
    const queue = [
      createCube('cube1', 'user1', Date.now() - 5000),
      createCube('cube2', 'user2', Date.now() - 4000),
      createCube('cube3', 'user3', Date.now() - 3000),
      createCube('cube4', 'user4', Date.now() - 2000),
      createCube('cube5', 'user5', Date.now() - 1000),
    ];

    mockQueueData(queue);

    // Mock patrons: only 2 are eligible (need 4 total for rotation)
    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    const inactivePatron = createPatron(PatronStatuses.INACTIVE, PatronLevels['Cobra Hatchling'] + 1);

    (Patron.getById as jest.Mock).mockImplementation((userId: string) => {
      if (userId === 'user1' || userId === 'user2') return Promise.resolve(activePatron);
      return Promise.resolve(inactivePatron);
    });

    (FeaturedQueue.delete as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('false');
    expect(result.messages).toContain('Not enough cubes in queue after patron check (need 4, have 2)');
    expect(result.removed).toHaveLength(3);

    // Verify ineligible cubes were still removed
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube3');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube4');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube5');
  });

  it('should handle large queue with multiple user cubes and mixed patron statuses', async () => {
    const queue = [
      createCube('cube1', 'alice', Date.now() - 10000),
      createCube('cube2', 'bob', Date.now() - 9000),
      createCube('cube3', 'charlie', Date.now() - 8000),
      createCube('cube4', 'diana', Date.now() - 7000),
      createCube('cube5', 'alice', Date.now() - 6000), // Same user as cube1
      createCube('cube6', 'eve', Date.now() - 5000),
      createCube('cube7', 'frank', Date.now() - 4000),
      createCube('cube8', 'grace', Date.now() - 3000),
    ];

    mockQueueData(queue);

    // Mock patrons: charlie, eve, and frank are ineligible
    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    const inactivePatron = createPatron(PatronStatuses.INACTIVE, PatronLevels['Cobra Hatchling'] + 1);

    (Patron.getById as jest.Mock).mockImplementation((userId: string) => {
      if (['charlie', 'eve', 'frank'].includes(userId)) {
        return Promise.resolve(inactivePatron);
      }
      return Promise.resolve(activePatron);
    });

    (FeaturedQueue.put as jest.Mock).mockResolvedValue({});
    (FeaturedQueue.delete as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('true');
    expect(result.removed).toHaveLength(3);
    expect(result.messages).toContain('Removed 3 cubes due to patron status');

    // Verify ineligible cubes were deleted
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube3');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube6');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube7');

    // Verify patron data was fetched only once per unique owner
    const uniqueOwners = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace'];
    expect(Patron.getById).toHaveBeenCalledTimes(uniqueOwners.length);

    // Verify rotation happened with remaining eligible cubes
    expect(result.added).toHaveLength(2);
    expect(result.added[0].cube).toBe('cube4'); // diana
    expect(result.added[1].cube).toBe('cube5'); // alice (second cube)

    // Verify old featured cubes (first 2) were moved to back
    expect(FeaturedQueue.put).toHaveBeenCalledWith(
      expect.objectContaining({
        cube: 'cube1',
      }),
    );
    expect(FeaturedQueue.put).toHaveBeenCalledWith(
      expect.objectContaining({
        cube: 'cube2',
      }),
    );
  });

  it('should handle patron with null or undefined status', async () => {
    const queue = [
      createCube('cube1', 'user1', Date.now() - 5000),
      createCube('cube2', 'user2', Date.now() - 4000),
      createCube('cube3', 'user3', Date.now() - 3000),
      createCube('cube4', 'user4', Date.now() - 2000),
      createCube('cube5', 'user5', Date.now() - 1000),
    ];

    mockQueueData(queue);

    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    const nullPatron = null;

    (Patron.getById as jest.Mock).mockImplementation((userId: string) => {
      if (userId === 'user3') return Promise.resolve(nullPatron);
      return Promise.resolve(activePatron);
    });

    (FeaturedQueue.put as jest.Mock).mockResolvedValue({});
    (FeaturedQueue.delete as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('true');
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].cube).toBe('cube3');
    expect(FeaturedQueue.delete).toHaveBeenCalledWith('cube3');
  });

  it('should correctly handle pagination when fetching queue', async () => {
    // Simulate paginated results
    const page1 = [createCube('cube1', 'user1', Date.now() - 4000), createCube('cube2', 'user2', Date.now() - 3000)];

    const page2 = [createCube('cube3', 'user3', Date.now() - 2000), createCube('cube4', 'user4', Date.now() - 1000)];

    (FeaturedQueue.querySortedByDate as jest.Mock)
      .mockResolvedValueOnce({ items: page1, lastKey: 'key1' })
      .mockResolvedValueOnce({ items: page2, lastKey: null });

    const activePatron = createPatron(PatronStatuses.ACTIVE, PatronLevels['Cobra Hatchling'] + 1);
    (Patron.getById as jest.Mock).mockResolvedValue(activePatron);
    (FeaturedQueue.put as jest.Mock).mockResolvedValue({});

    const result = await rotateFeatured();

    expect(result.success).toBe('true');
    expect(FeaturedQueue.querySortedByDate).toHaveBeenCalledTimes(2);
    expect(FeaturedQueue.querySortedByDate).toHaveBeenNthCalledWith(1, null);
    expect(FeaturedQueue.querySortedByDate).toHaveBeenNthCalledWith(2, 'key1');
  });
});
