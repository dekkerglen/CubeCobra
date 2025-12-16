import Card, { Changes } from '@utils/datatypes/Card';
import { v4 as UUID } from 'uuid';

import { changelogDao } from '../../src/dynamo/daos';
import { getBucketName } from '../../src/dynamo/s3client';
import {
  createCard,
  createCardDetails,
  createChangelog,
  createChangelogCardAdd,
  createChangelogCardEdit,
  createChangelogCardRemove,
  createChangelogCardSwap,
} from '../test-utils/data';

// Mock dependencies

//Mocking uuid has side-effect of making the data generators from test-utils/data use the mock too
jest.mock('uuid');
jest.mock('serverutils/carddb');
jest.mock('../../src/dynamo/s3client');
jest.mock('../../src/dynamo/daos', () => ({
  changelogDao: {
    getChangelog: jest.fn(),
    queryByCubeWithData: jest.fn(),
    createChangelog: jest.fn(),
    batchGet: jest.fn(),
  },
}));

// Test helpers

const createHydratedChangelog = (initialChanges: Changes, hydratedCard: Card): Changes => {
  const mockHydratedChanges = { ...initialChanges };
  if (mockHydratedChanges.mainboard?.adds) {
    mockHydratedChanges.mainboard.adds[0].details = hydratedCard.details;
  }
  if (mockHydratedChanges.mainboard?.removes) {
    mockHydratedChanges.mainboard.removes[0].oldCard.details = hydratedCard.details;
  }

  if (mockHydratedChanges.mainboard?.edits) {
    mockHydratedChanges.mainboard.edits[0].oldCard.details = hydratedCard.details;
    mockHydratedChanges.mainboard.edits[0].newCard.details = hydratedCard.details;
  }

  if (mockHydratedChanges.mainboard?.swaps) {
    mockHydratedChanges.mainboard.swaps[0].oldCard.details = hydratedCard.details;
    mockHydratedChanges.mainboard.swaps[0].card.details = hydratedCard.details;
  }

  return mockHydratedChanges;
};

describe('Changelog Model', () => {
  const mockCardDetails = createCardDetails();
  const mockCard = createCard({ cardID: 'card-123', details: mockCardDetails });

  const mockAdd = createChangelogCardAdd();
  const mockRemove = createChangelogCardRemove();
  const mockEdit = createChangelogCardEdit();
  const mockSwap = createChangelogCardSwap();

  const mockChanges = createChangelog({
    adds: [mockAdd],
    removes: [mockRemove],
    edits: [mockEdit],
    swaps: [mockSwap],
  });

  /* In the real world these would all be different cards / details, but for simplicity of tests...
   * Extending the existing mocks so the indexes are consistent between the unhydrated and hydrated.
   * Conditions are to appease Typescript since mainboard/adds can be undefined.
   */
  const mockHydratedChanges = createHydratedChangelog(mockChanges, mockCard);

  const mockCardDetailsTwo = createCardDetails();
  const mockCardTwo = createCard({ cardID: 'card-567', details: mockCardDetailsTwo });

  const mockChangesTwo = { ...mockChanges };
  const mockHydratedChangesTwo = createHydratedChangelog(mockChangesTwo, mockCardTwo);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (UUID as jest.Mock).mockReturnValue('changelog-2');
    (getBucketName as jest.Mock).mockReturnValue('test-bucket');
  });

  describe('getChangelog', () => {
    it('returns hydrated changelog', async () => {
      (changelogDao.getChangelog as jest.Mock).mockResolvedValueOnce(mockHydratedChanges);

      const result = await changelogDao.getChangelog('cube-1', 'changelog-1');

      expect(result).toEqual(mockHydratedChanges);
      expect(changelogDao.getChangelog).toHaveBeenCalledWith('cube-1', 'changelog-1');
    });

    it('returns hydrated changelog for maybeboard', async () => {
      const maybeboardHydratedChanges = {
        maybeboard: mockHydratedChanges.mainboard,
      };

      (changelogDao.getChangelog as jest.Mock).mockResolvedValueOnce(maybeboardHydratedChanges);

      const result = await changelogDao.getChangelog('cube-1', 'changelog-1');

      expect(result).toEqual(maybeboardHydratedChanges);
      expect(changelogDao.getChangelog).toHaveBeenCalledWith('cube-1', 'changelog-1');
    });
  });

  describe('queryByCubeWithData', () => {
    it('returns empty result when no changelogs found', async () => {
      (changelogDao.queryByCubeWithData as jest.Mock).mockResolvedValueOnce({
        items: [],
        lastKey: undefined,
      });

      const result = await changelogDao.queryByCubeWithData('cube-1', undefined, 10);

      expect(result).toEqual({ items: [], lastKey: undefined });
    });

    it('returns hydrated changelogs with pagination', async () => {
      const mockItems = [
        {
          cubeId: 'cube-1',
          date: new Date('2024-03-24').valueOf(),
          changelog: mockHydratedChanges,
        },
        {
          cubeId: 'cube-1',
          date: 1742997330,
          changelog: mockHydratedChangesTwo,
        },
      ];

      (changelogDao.queryByCubeWithData as jest.Mock).mockResolvedValueOnce({
        items: mockItems,
        lastKey: { S: 'last-key-1' },
      });

      const result = await changelogDao.queryByCubeWithData('cube-1', undefined, 10);

      expect(result.items?.length).toBe(2);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      expect(result.items?.[0]).toEqual(mockItems[0]);
      expect(result.items?.[1]).toEqual(mockItems[1]);
    });
  });

  describe('createChangelog', () => {
    it('creates new changelog entry', async () => {
      (changelogDao.createChangelog as jest.Mock).mockResolvedValueOnce('changelog-2');

      const result = await changelogDao.createChangelog(mockChanges, 'cube-1');

      expect(result).toBe('changelog-2');
      expect(changelogDao.createChangelog).toHaveBeenCalledWith(mockChanges, 'cube-1');
    });
  });

  describe('batchGet', () => {
    it('retrieves multiple hydrated changelogs', async () => {
      const keys = [
        { cube: 'cube-1', id: 'changelog-1' },
        { cube: 'cube-2', id: 'changelog-2' },
      ];

      (changelogDao.batchGet as jest.Mock).mockResolvedValueOnce([mockHydratedChanges, mockHydratedChangesTwo]);

      const result = await changelogDao.batchGet(keys);

      expect(result).toHaveLength(2);
      expect(changelogDao.batchGet).toHaveBeenCalledWith(keys);
      expect(result[0]).toEqual(mockHydratedChanges);
      expect(result[1]).toEqual(mockHydratedChangesTwo);
    });

    it('handles empty keys array', async () => {
      (changelogDao.batchGet as jest.Mock).mockResolvedValueOnce([]);

      const result = await changelogDao.batchGet([]);

      expect(result).toHaveLength(0);
    });
  });
});
