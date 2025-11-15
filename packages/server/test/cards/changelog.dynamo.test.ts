import Card, { Changes } from '@utils/datatypes/Card';
import ChangelogType from '@utils/datatypes/ChangeLog';
import { cardFromId } from 'serverutils/carddb';
import { v4 as UUID } from 'uuid';

import Changelog from '../../src/dynamo/models/changelog';
import { getBucketName, getObject, putObject } from '../../src/dynamo/s3client';
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
jest.mock('../../src/dynamo/util');

// Test helpers
const createUnhydratedChangelog = (overrides?: Partial<ChangelogType>): ChangelogType => ({
  id: 'changelog-1',
  cube: 'cube-1',
  date: new Date('2024-03-24').valueOf(),
  ...overrides,
});

const setupQueryResult = (response: any) => {
  (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce(response);
};

const verifyQueryCall = (params: any) => {
  expect(mockDynamoClient.query).toHaveBeenCalledWith(expect.objectContaining(params));
};

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

describe('Changelog Model Initialization', () => {
  it('creates changelog table with proper configuration', async () => {
    require('../../src/dynamo/models/changelog');

    expect(mockDynamoCreateClient).toHaveBeenCalledWith({
      name: 'CUBE_CHANGELOG',
      partitionKey: 'cube',
      sortKey: 'date',
      attributes: {
        cube: 'S',
        date: 'N',
      },
    });
  });
});

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
  const mockStoredChangelog = createUnhydratedChangelog();

  /* In the real world these would all be different cards / details, but for simplicity of tests...
   * Extending the existing mocks so the indexes are consistent between the unhydrated and hydrated.
   * Conditions are to appease Typescript since mainboard/adds can be undefined.
   */
  const mockHydratedChanges = createHydratedChangelog(mockChanges, mockCard);

  const mockCardDetailsTwo = createCardDetails();
  const mockCardTwo = createCard({ cardID: 'card-567', details: mockCardDetailsTwo });

  const mockChangesTwo = { ...mockChanges };
  const mockHydratedChangesTwo = createHydratedChangelog(mockChangesTwo, mockCardTwo);

  const setupMultipleCardDetails = () => {
    (cardFromId as jest.Mock).mockImplementation((cardID: string) => {
      if (cardID === mockCard.cardID) {
        return mockCard.details;
      } else {
        return mockCardTwo.details;
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (UUID as jest.Mock).mockReturnValue('changelog-2');
    (getBucketName as jest.Mock).mockReturnValue('test-bucket');
  });

  describe('getById', () => {
    it('returns hydrated changelog', async () => {
      (getObject as jest.Mock).mockResolvedValueOnce(mockChanges);
      (cardFromId as jest.Mock).mockReturnValue(mockCardDetails);

      const result = await Changelog.getById('cube-1', 'changelog-1');

      expect(result).toEqual(mockHydratedChanges);
      expect(getObject).toHaveBeenCalledWith('test-bucket', 'changelog/cube-1/changelog-1.json');
    });

    it('returns hydrated changelog for maybeboard', async () => {
      const maybeboardChanges = {
        maybeboard: mockChanges.mainboard,
      };
      const maybeboardHydratedChanges = {
        maybeboard: mockHydratedChanges.mainboard,
      };

      (getObject as jest.Mock).mockResolvedValueOnce(maybeboardChanges);
      (cardFromId as jest.Mock).mockReturnValue(mockCardDetails);

      const result = await Changelog.getById('cube-1', 'changelog-1');

      expect(result).toEqual(maybeboardHydratedChanges);
      expect(getObject).toHaveBeenCalledWith('test-bucket', 'changelog/cube-1/changelog-1.json');
    });

    it('returns hydrated changelog for partial changesets', async () => {
      const partialChanges = { ...mockChanges };
      //If conditions to appease Typescript
      if (partialChanges?.mainboard?.adds) {
        delete partialChanges.mainboard.adds;
      }
      if (partialChanges?.mainboard?.swaps) {
        delete partialChanges.mainboard.swaps;
      }

      const partialHydratedChanges = { ...mockHydratedChanges };
      if (partialHydratedChanges?.mainboard?.adds) {
        delete partialHydratedChanges.mainboard.adds;
      }
      if (partialHydratedChanges?.mainboard?.swaps) {
        delete partialHydratedChanges.mainboard.swaps;
      }

      (getObject as jest.Mock).mockResolvedValueOnce(partialChanges);
      (cardFromId as jest.Mock).mockReturnValue(mockCardDetails);

      const result = await Changelog.getById('cube-1', 'changelog-1');

      expect(result).toEqual(partialHydratedChanges);
      expect(getObject).toHaveBeenCalledWith('test-bucket', 'changelog/cube-1/changelog-1.json');
    });

    it('returns raw changelog when hydration fails', async () => {
      (getObject as jest.Mock).mockResolvedValueOnce(mockChanges);
      (cardFromId as jest.Mock).mockImplementation(() => {
        throw new Error('Card not found');
      });

      const result = await Changelog.getById('cube-1', 'changelog-1');

      expect(result).toEqual(mockChanges);
      expect(getObject).toHaveBeenCalledWith('test-bucket', 'changelog/cube-1/changelog-1.json');
    });

    it('returns raw changelog when there are too many cards to hydrate', async () => {
      const largeChangelog = createChangelog({
        adds: Array(5001).fill(mockAdd),
        removes: Array(5000).fill(mockRemove),
      });
      (getObject as jest.Mock).mockResolvedValueOnce(largeChangelog);
      (cardFromId as jest.Mock).mockReturnValue(mockCardDetails);

      const result = await Changelog.getById('cube-1', 'changelog-1');

      expect(result).toEqual(largeChangelog);
      expect(getObject).toHaveBeenCalledWith('test-bucket', 'changelog/cube-1/changelog-1.json');
      expect(cardFromId).not.toHaveBeenCalled();
    });
  });

  describe('getByCube', () => {
    it('returns empty result when no changelogs found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: undefined });

      const result = await Changelog.getByCube('cube-1', 10);

      expect(result).toEqual({ items: [], lastKey: undefined });
      verifyQueryCall({
        KeyConditionExpression: '#p1 = :cube',
        ExpressionAttributeValues: { ':cube': 'cube-1' },
        ExpressionAttributeNames: { '#p1': 'cube' },
        Limit: 10,
        ScanIndexForward: false,
      });
    });

    it('returns hydrated changelogs with pagination', async () => {
      const changelogs = [
        createUnhydratedChangelog(),
        createUnhydratedChangelog({ id: 'changelog-2', date: 1742997330 }),
      ];
      setupQueryResult({
        Items: changelogs,
        LastEvaluatedKey: { S: 'last-key-1' },
      });

      (getObject as jest.Mock).mockResolvedValueOnce(mockChanges);
      (getObject as jest.Mock).mockResolvedValueOnce(mockChangesTwo);

      setupMultipleCardDetails();

      const result = await Changelog.getByCube('cube-1', 10);

      expect(result.items?.length).toBe(2);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      expect(result.items?.[0]).toEqual({
        cubeId: 'cube-1',
        date: changelogs[0].date,
        changelog: mockHydratedChanges,
      });
      expect(result.items?.[1]).toEqual({
        cubeId: 'cube-1',
        date: 1742997330,
        changelog: mockHydratedChangesTwo,
      });
    });

    it('uses default limit when input is falsey', async () => {
      const changelogs = [createUnhydratedChangelog()];
      setupQueryResult({
        Items: changelogs,
        LastEvaluatedKey: { S: 'last-key-1' },
      });
      (getObject as jest.Mock).mockResolvedValueOnce(mockChanges);

      const result = await Changelog.getByCube('cube-1', 0);

      expect(result.items?.length).toBe(1);
      verifyQueryCall({
        Limit: 36,
      });
    });
  });

  describe('put', () => {
    it('creates new changelog entry', async () => {
      const result = await Changelog.put(mockChanges, 'cube-1');

      expect(result).toBe('changelog-2');
      expect(putObject).toHaveBeenCalledWith(
        'test-bucket',
        'changelog/cube-1/changelog-2.json',
        expect.objectContaining(mockChanges),
      );
      expect(mockDynamoClient.put).toHaveBeenCalledWith({
        id: 'changelog-2',
        cube: 'cube-1',
        date: expect.any(Number),
      });
    });

    it('card details are stripped before saving', async () => {
      const result = await Changelog.put(mockHydratedChanges, 'cube-1');

      expect(result).toBe('changelog-2');
      expect(putObject).toHaveBeenCalledWith('test-bucket', 'changelog/cube-1/changelog-2.json', mockChanges);
      expect(mockDynamoClient.put).toHaveBeenCalledWith({
        id: 'changelog-2',
        cube: 'cube-1',
        date: expect.any(Number),
      });
    });
  });

  describe('scan', () => {
    it('returns all changelogs with pagination', async () => {
      (mockDynamoClient.scan as jest.Mock).mockResolvedValueOnce({
        Items: [mockStoredChangelog],
        LastEvaluatedKey: { S: 'last-key-1' },
      });

      const result = await Changelog.scan(10, { S: 'key-1' });

      expect(result).toEqual({
        items: [mockStoredChangelog],
        lastKey: { S: 'last-key-1' },
      });
      expect(mockDynamoClient.scan).toHaveBeenCalledWith({
        ExclusiveStartKey: { S: 'key-1' },
        Limit: 10,
      });
    });

    it('uses default limit when input is falsey', async () => {
      (mockDynamoClient.scan as jest.Mock).mockResolvedValueOnce({
        Items: [mockStoredChangelog],
        LastEvaluatedKey: null,
      });

      const result = await Changelog.scan(0);

      expect(result).toEqual({
        items: [mockStoredChangelog],
        lastKey: null,
      });
      expect(mockDynamoClient.scan).toHaveBeenCalledWith({
        Limit: 36,
      });
    });
  });

  describe('batchGet', () => {
    it('retrieves multiple hydrated changelogs', async () => {
      const keys = [
        { cube: 'cube-1', id: 'changelog-1' },
        { cube: 'cube-2', id: 'changelog-2' },
      ];
      (getObject as jest.Mock).mockResolvedValueOnce(mockChanges);
      (getObject as jest.Mock).mockResolvedValueOnce(mockChangesTwo);

      setupMultipleCardDetails();

      const result = await Changelog.batchGet(keys);

      expect(result).toHaveLength(2);
      expect(getObject).toHaveBeenCalledTimes(2);
      keys.forEach((key, index) => {
        expect(getObject).toHaveBeenNthCalledWith(index + 1, 'test-bucket', `changelog/${key.cube}/${key.id}.json`);
      });
      expect(result[0]).toEqual(mockHydratedChanges);
      expect(result[1]).toEqual(mockHydratedChangesTwo);
    });

    it('returns raw changelogs on error', async () => {
      const keys = [
        { cube: 'cube-1', id: 'changelog-1' },
        { cube: 'cube-2', id: 'changelog-2' },
      ];
      (getObject as jest.Mock).mockResolvedValueOnce(mockChanges);
      (getObject as jest.Mock).mockResolvedValueOnce(mockChangesTwo);

      (cardFromId as jest.Mock).mockImplementation((cardID: string) => {
        if (cardID === mockCard.cardID) {
          return mockCard.details;
        } else {
          throw new Error('Unexpected failure in hydrating');
        }
      });

      const result = await Changelog.batchGet(keys);

      expect(result).toHaveLength(2);
      expect(getObject).toHaveBeenCalledTimes(2);
      keys.forEach((key, index) => {
        expect(getObject).toHaveBeenNthCalledWith(index + 1, 'test-bucket', `changelog/${key.cube}/${key.id}.json`);
      });
      expect(result[0]).toEqual(mockHydratedChanges);
      expect(result[1]).toEqual(mockChangesTwo);
    });
  });

  describe('createTable', () => {
    it('calls client to create table', async () => {
      await Changelog.createTable();

      expect(mockDynamoClient.createTable).toHaveBeenCalled();
    });
  });
});
