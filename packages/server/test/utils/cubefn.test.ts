import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { cardFromId } from 'serverutils/carddb';
import { compareCubes, generateBalancedPack, generatePack } from 'serverutils/cubefn';
import { getBotPrediction } from 'serverutils/userUtil';

import { createCardDetails, createCube,createCustomCard } from '../test-utils/data';

// Mock dependencies
jest.mock('serverutils/userUtil');
jest.mock('@utils/drafting/createdraft');
jest.mock('serverutils/carddb');

const mockGetBotPrediction = getBotPrediction as jest.MockedFunction<typeof getBotPrediction>;
const mockGetDraftFormat = getDraftFormat as jest.MockedFunction<typeof getDraftFormat>;
const mockCreateDraft = createDraft as jest.MockedFunction<typeof createDraft>;
const mockCardFromId = cardFromId as jest.MockedFunction<typeof cardFromId>;

// Shared test data
const createSharedTestData = () => {
  const mockCube = createCube();
  const mockCards = {
    mainboard: Array.from({ length: 15 }, (_, i) => ({ cardID: `card${i + 1}` })),
  };
  const mockFormat = { packs: [{ slots: ['any'], count: 15 }] };
  const mockDraft = {
    InitialState: [[{ cards: Array.from({ length: 15 }, (_, i) => i) }]],
    cards: Array.from({ length: 15 }, (_, i) => ({ cardID: `card${i + 1}` })),
  };

  return { mockCube, mockCards, mockFormat, mockDraft };
};

// Shared setup function
const setupMocks = (mockFormat: any, mockDraft: any) => {
  jest.clearAllMocks();
  mockGetDraftFormat.mockReturnValue(mockFormat as any);
  mockCreateDraft.mockReturnValue(mockDraft as any);
  mockCardFromId.mockImplementation((cardID) => createCardDetails({ oracle_id: `oracle_${cardID}` }));
};

// Helper function to create normalized bot weights that sum to 1
const createNormalizedWeights = (weights: number[]): number[] => {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return weights.map((w) => w / sum);
};

// Helper to create realistic 15-card weight distribution
const createRealistic15CardWeights = (): number[] => {
  // Simulate a typical pack: 1 rare (high weight), 3 uncommons (medium), 11 commons (low)
  const rawWeights = [
    0.9, // rare
    0.6,
    0.5,
    0.7, // uncommons
    0.1,
    0.1,
    0.2,
    0.1,
    0.1,
    0.3,
    0.1,
    0.2,
    0.1,
    0.1,
    0.2, // commons
  ];
  return createNormalizedWeights(rawWeights);
};

interface BalancedPackResult {
  packResult: {
    seed: string;
    pack: any[];
  };
  botResult: {
    botPickIndex: number | null;
    botWeights: number[];
  };
  seed: string;
  maxBotWeight: number;
  allCandidates: any[];
}

describe('generateBalancedPack', () => {
  const { mockCube, mockCards, mockFormat, mockDraft } = createSharedTestData();

  beforeEach(() => {
    setupMocks(mockFormat, mockDraft);
  });

  describe('basic functionality', () => {
    it('should generate a balanced pack with default parameters', async () => {
      // Mock bot prediction with normalized weights for 15 cards
      const normalizedWeights = createRealistic15CardWeights();
      mockGetBotPrediction.mockResolvedValue({
        botWeights: normalizedWeights,
        botPickIndex: 0, // Should pick the rare (highest weight)
      });

      const result = (await generateBalancedPack(mockCube, mockCards, 'test-seed')) as BalancedPackResult;

      expect(result).toHaveProperty('packResult');
      expect(result).toHaveProperty('botResult');
      expect(result).toHaveProperty('seed', 'test-seed');
      expect(result).toHaveProperty('maxBotWeight');
      expect(result).toHaveProperty('allCandidates');

      expect(result.packResult.pack).toHaveLength(15);
      expect(result.packResult.seed).toBe('test-seed');
      expect(result.allCandidates).toHaveLength(10); // default candidateCount
    });

    it('should use custom candidate count', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [0.5],
        botPickIndex: 0,
      });

      const candidateCount = 5;
      const result = (await generateBalancedPack(
        mockCube,
        mockCards,
        'test-seed',
        candidateCount,
      )) as BalancedPackResult;

      expect(result.allCandidates).toHaveLength(candidateCount);
      expect(mockCreateDraft).toHaveBeenCalledTimes(candidateCount);
    });

    it('should use deterministic seed when provided', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [0.5],
        botPickIndex: 0,
      });

      const deterministicSeed = 12345;
      await generateBalancedPack(mockCube, mockCards, 'test-seed', 3, deterministicSeed as any);

      // Verify that createDraft was called with seeds based on deterministicSeed
      expect(mockCreateDraft).toHaveBeenCalledWith(
        mockCube,
        mockFormat,
        mockCards.mainboard,
        1,
        { username: 'Anonymous' },
        expect.stringContaining(`test-seed-${deterministicSeed}`),
      );
    });

    it('should use Date.now() when deterministicSeed is null', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [0.5],
        botPickIndex: 0,
      });

      const spy = jest.spyOn(Date, 'now').mockReturnValue(67890);

      await generateBalancedPack(mockCube, mockCards, 'test-seed', 3, null);

      expect(mockCreateDraft).toHaveBeenCalledWith(
        mockCube,
        mockFormat,
        mockCards.mainboard,
        1,
        { username: 'Anonymous' },
        expect.stringContaining('test-seed-67890'),
      );

      spy.mockRestore();
    });
  });

  describe('pack selection logic', () => {
    it('should select pack with lowest maximum bot weight', async () => {
      // Create mock candidates with different max bot weights for 15-card packs
      const candidates = [
        {
          // Pack 1: Bomb rare dominates (max = 0.3913043478)
          botWeights: createNormalizedWeights([
            0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
          ]),
          botPickIndex: 0,
        },
        {
          // Pack 2: More balanced distribution (max = 0.1142857143, should be selected)
          botWeights: createNormalizedWeights([
            0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.1, 0.1,
          ]),
          botPickIndex: 0,
        },
        {
          // Pack 3: Two strong cards (max = 0.2592592593)
          botWeights: createNormalizedWeights([
            0.7, 0.7, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
          ]),
          botPickIndex: 0,
        },
      ];

      let callCount = 0;
      mockGetBotPrediction.mockImplementation(async () => {
        const candidate = candidates[callCount % candidates.length]!;
        callCount += 1;
        return candidate;
      });

      const result = (await generateBalancedPack(mockCube, mockCards, 'test-seed', 3)) as BalancedPackResult;

      // Should select pack 2 (most balanced distribution)
      expect(result.allCandidates).toHaveLength(3);
      expect(result.maxBotWeight).toBeCloseTo(0.1142857143, 10); // Pack 2's exact max weight

      // Verify all candidates have expected max weights
      expect(result.allCandidates[0].maxBotWeight).toBeCloseTo(0.3913043478, 10); // Pack 1
      expect(result.allCandidates[1].maxBotWeight).toBeCloseTo(0.1142857143, 10); // Pack 2 (selected)
      expect(result.allCandidates[2].maxBotWeight).toBeCloseTo(0.2592592593, 10); // Pack 3

      // Verify pack 2 was selected (lowest max weight)
      const maxWeights = result.allCandidates.map((c) => c.maxBotWeight);
      expect(result.maxBotWeight).toBe(Math.min(...maxWeights));
    });

    it('should handle empty bot weights', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [],
        botPickIndex: null,
      });

      const result = (await generateBalancedPack(mockCube, mockCards, 'test-seed', 1)) as BalancedPackResult;

      expect(result.maxBotWeight).toBe(0);
    });

    it('should handle single bot weight', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [1.0], // Single card gets all probability
        botPickIndex: 0,
      });

      const result = (await generateBalancedPack(mockCube, mockCards, 'test-seed', 1)) as BalancedPackResult;

      expect(result.maxBotWeight).toBe(1.0);
    });
  });

  describe('pack generation', () => {
    it('should generate pack with correct card details', async () => {
      const normalizedWeights = createRealistic15CardWeights();
      mockGetBotPrediction.mockResolvedValue({
        botWeights: normalizedWeights,
        botPickIndex: 0,
      });

      const result = (await generateBalancedPack(mockCube, mockCards, 'test-seed', 1)) as BalancedPackResult;

      expect(result.packResult.pack).toHaveLength(15);

      result.packResult.pack.forEach((card: any, index: number) => {
        expect(card).toHaveProperty('cardID', mockDraft.cards[index]!.cardID);
        expect(card).toHaveProperty('details');
        expect(card.details).toHaveProperty('oracle_id', expect.stringContaining('oracle_'));
      });
    });

    it('should call getDraftFormat with correct parameters', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [0.5],
        botPickIndex: 0,
      });

      const cubeWithFormat = { ...mockCube, defaultFormat: 5 };
      await generateBalancedPack(cubeWithFormat, mockCards, 'test-seed', 1);

      expect(mockGetDraftFormat).toHaveBeenCalledWith({ id: 5, packs: 1, players: 1 }, cubeWithFormat);
    });

    it('should handle cube without defaultFormat', async () => {
      mockGetBotPrediction.mockResolvedValue({
        botWeights: [0.5],
        botPickIndex: 0,
      });

      const cubeWithoutFormat = { ...mockCube, defaultFormat: undefined };
      await generateBalancedPack(cubeWithoutFormat, mockCards, 'test-seed', 1);

      expect(mockGetDraftFormat).toHaveBeenCalledWith({ id: -1, packs: 1, players: 1 }, cubeWithoutFormat);
    });
  });

  describe('bot prediction integration', () => {
    it('should extract oracle IDs correctly', async () => {
      const mockDetails = Array.from({ length: 15 }, (_, i) => createCardDetails({ oracle_id: `oracle${i + 1}` }));

      mockCardFromId.mockImplementation((cardID) => {
        const index = mockDraft.cards.findIndex((c) => c.cardID === cardID);
        return mockDetails[index]!;
      });

      const normalizedWeights = createRealistic15CardWeights();
      mockGetBotPrediction.mockResolvedValue({
        botWeights: normalizedWeights,
        botPickIndex: 0,
      });

      await generateBalancedPack(mockCube, mockCards, 'test-seed', 1);

      expect(mockGetBotPrediction).toHaveBeenCalledWith([
        'oracle1',
        'oracle2',
        'oracle3',
        'oracle4',
        'oracle5',
        'oracle6',
        'oracle7',
        'oracle8',
        'oracle9',
        'oracle10',
        'oracle11',
        'oracle12',
        'oracle13',
        'oracle14',
        'oracle15',
      ]);
    });

    it('should filter out cards without oracle_id', async () => {
      mockCardFromId.mockImplementation((cardID) => {
        if (cardID === 'card2' || cardID === 'card5' || cardID === 'card10') {
          return createCardDetails({ oracle_id: undefined });
        }
        return createCardDetails({ oracle_id: `oracle_${cardID}` });
      });

      // Create normalized weights for 12 cards (15 - 3 filtered out)
      const normalizedWeights = createNormalizedWeights([0.5, 0.8, 0.3, 0.6, 0.4, 0.7, 0.2, 0.9, 0.1, 0.5, 0.8, 0.3]);
      mockGetBotPrediction.mockResolvedValue({
        botWeights: normalizedWeights,
        botPickIndex: 7, // Should pick index 7 (highest weight of 0.9 normalized)
      });

      await generateBalancedPack(mockCube, mockCards, 'test-seed', 1);

      // Should exclude card2, card5, and card10 (no oracle_id)
      expect(mockGetBotPrediction).toHaveBeenCalledWith([
        'oracle_card1',
        'oracle_card3',
        'oracle_card4',
        'oracle_card6',
        'oracle_card7',
        'oracle_card8',
        'oracle_card9',
        'oracle_card11',
        'oracle_card12',
        'oracle_card13',
        'oracle_card14',
        'oracle_card15',
      ]);
    });
  });
});

describe('generatePack', () => {
  const { mockCube, mockCards, mockFormat, mockDraft } = createSharedTestData();

  beforeEach(() => {
    setupMocks(mockFormat, mockDraft);
  });

  describe('basic functionality', () => {
    it('should generate a pack with default parameters', async () => {
      const result = await generatePack(mockCube, mockCards);

      expect(result).toHaveProperty('seed');
      expect(result).toHaveProperty('pack');
      expect(result.pack).toHaveLength(15);
      expect(typeof result.seed).toBe('string');
    });

    it('should generate a pack with provided seed', async () => {
      const customSeed = 'test-seed-123';
      const result = await generatePack(mockCube, mockCards, customSeed);

      expect(result.seed).toBe(customSeed);
      expect(result.pack).toHaveLength(15);
    });

    it('should generate different packs with different seeds', async () => {
      const result1 = await generatePack(mockCube, mockCards, 'seed1');
      const result2 = await generatePack(mockCube, mockCards, 'seed2');

      expect(result1.seed).toBe('seed1');
      expect(result2.seed).toBe('seed2');
      expect(result1.seed).not.toBe(result2.seed);
    });

    it('should use Date.now() as seed when no seed provided', async () => {
      const spy = jest.spyOn(Date, 'now').mockReturnValue(12345);

      const result = await generatePack(mockCube, mockCards);

      expect(result.seed).toBe('12345');
      spy.mockRestore();
    });
  });

  describe('pack generation', () => {
    it('should generate pack with correct card details', async () => {
      const result = await generatePack(mockCube, mockCards, 'test-seed');

      expect(result.pack).toHaveLength(15);

      result.pack.forEach((card: any, index: number) => {
        expect(card).toHaveProperty('cardID', mockDraft.cards[index]!.cardID);
        expect(card).toHaveProperty('details');
        expect(card.details).toHaveProperty('oracle_id', expect.stringContaining('oracle_'));
      });
    });

    it('should call getDraftFormat with correct parameters', async () => {
      const cubeWithFormat = { ...mockCube, defaultFormat: 5 };
      await generatePack(cubeWithFormat, mockCards, 'test-seed');

      expect(mockGetDraftFormat).toHaveBeenCalledWith({ id: 5, packs: 1, players: 1 }, cubeWithFormat);
    });

    it('should handle cube without defaultFormat', async () => {
      const cubeWithoutFormat = { ...mockCube, defaultFormat: undefined };
      await generatePack(cubeWithoutFormat, mockCards, 'test-seed');

      expect(mockGetDraftFormat).toHaveBeenCalledWith({ id: -1, packs: 1, players: 1 }, cubeWithoutFormat);
    });

    it('should call createDraft with correct parameters', async () => {
      await generatePack(mockCube, mockCards, 'test-seed');

      expect(mockCreateDraft).toHaveBeenCalledWith(
        mockCube,
        mockFormat,
        mockCards.mainboard,
        1,
        { username: 'Anonymous' },
        'test-seed',
      );
    });
  });

  describe('card details integration', () => {
    it('should call cardFromId for each card in the pack', async () => {
      await generatePack(mockCube, mockCards, 'test-seed');

      // Should call cardFromId for each card in the draft
      expect(mockCardFromId).toHaveBeenCalledTimes(15);
      mockDraft.cards.forEach((card) => {
        expect(mockCardFromId).toHaveBeenCalledWith(card.cardID);
      });
    });

    it('should include card details in pack result', async () => {
      const mockDetails = createCardDetails({
        oracle_id: 'test-oracle-id',
        name: 'Test Card',
      });

      mockCardFromId.mockReturnValue(mockDetails);

      const result = await generatePack(mockCube, mockCards, 'test-seed');

      result.pack.forEach((card: any) => {
        expect(card.details).toEqual(mockDetails);
      });
    });
  });

  describe('seed type handling', () => {
    test.each([
      ['string seed', 'string-seed', 'string-seed'],
      ['number seed', 42, 42],
    ])('should handle %s', async (_description, inputSeed, expectedSeed) => {
      const result = await generatePack(mockCube, mockCards, inputSeed as any);
      expect(result.seed).toBe(expectedSeed);
    });

    test.each([
      ['empty string seed', '', 99999],
      ['null seed', null, 88888],
      ['undefined seed', undefined, 77777],
    ])('should handle %s by using Date.now()', async (_description, inputSeed, mockDateValue) => {
      const spy = jest.spyOn(Date, 'now').mockReturnValue(mockDateValue);

      const result = await generatePack(mockCube, mockCards, inputSeed as any);

      expect(result.seed).toBe(mockDateValue.toString());
      spy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty mainboard', async () => {
      const emptyCards = { mainboard: [] };
      const emptyDraft = {
        InitialState: [[{ cards: [] }]],
        cards: [],
      };

      mockCreateDraft.mockReturnValue(emptyDraft as any);

      const result = await generatePack(mockCube, emptyCards, 'test-seed');

      expect(result.pack).toHaveLength(0);
      expect(result.seed).toBe('test-seed');
    });

    it('should handle cube with custom format', async () => {
      const customFormat = { packs: [{ slots: ['red'], count: 8 }] };
      const customDraft = {
        InitialState: [[{ cards: [0, 1, 2, 3, 4, 5, 6, 7] }]],
        cards: Array.from({ length: 8 }, (_, i) => ({ cardID: `card${i + 1}` })),
      };

      mockGetDraftFormat.mockReturnValue(customFormat as any);
      mockCreateDraft.mockReturnValue(customDraft as any);

      const result = await generatePack(mockCube, mockCards, 'test-seed');

      expect(result.pack).toHaveLength(8);
    });
  });
});

describe('compareCubes', () => {
  /**
   * Helper function to create a card with oracle_id and name
   */
  const createComparisonCard = (index: number, oracleId?: string, name?: string): any => ({
    cardID: `card${index}`,
    details: {
      oracle_id: oracleId || `oracle${index}`,
      name: name || `Card ${index}`,
    },
  });

  describe('basic functionality', () => {
    it('should identify cards in both cubes', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1), createComparisonCard(2), createComparisonCard(3)],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(1), createComparisonCard(2), createComparisonCard(4)],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.inBoth).toHaveLength(2);
      expect(result.inBoth.map((c: any) => c.details.oracle_id)).toEqual(['oracle1', 'oracle2']);
    });

    it('should identify cards only in cube A', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1), createComparisonCard(2), createComparisonCard(3)],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(1), createComparisonCard(4)],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.onlyA).toHaveLength(2);
      expect(result.onlyA.map((c: any) => c.details.oracle_id)).toEqual(['oracle2', 'oracle3']);
    });

    it('should identify cards only in cube B', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1), createComparisonCard(2)],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(1), createComparisonCard(3), createComparisonCard(4)],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.onlyB).toHaveLength(2);
      expect(result.onlyB.map((c: any) => c.details.oracle_id)).toEqual(['oracle3', 'oracle4']);
    });
  });

  describe('comparison results', () => {
    it('should return all oracle IDs from cube A', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1), createComparisonCard(2), createComparisonCard(3)],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(1)],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.aOracles).toHaveLength(2);
      expect(result.aOracles).toEqual(['oracle2', 'oracle3']);
    });

    it('should return all oracle IDs from cube B', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1)],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(1), createComparisonCard(2), createComparisonCard(3)],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.bOracles).toHaveLength(2);
      expect(result.bOracles).toEqual(['oracle2', 'oracle3']);
    });

    it('should return all cards combined in allCards property. Ordered by both, only A, only B', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1), createComparisonCard(2)],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(2), createComparisonCard(3)],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.allCards).toHaveLength(3);
      expect(result.allCards.map((c: any) => c.details.oracle_id)).toEqual(['oracle2', 'oracle1', 'oracle3']);
    });
  });

  describe('identical cubes', () => {
    it('should handle identical cubes', async () => {
      const cards = {
        mainboard: [createComparisonCard(1), createComparisonCard(2), createComparisonCard(3)],
        maybeboard: [],
      };

      const result = await compareCubes(cards, cards);

      expect(result.inBoth).toHaveLength(3);
      expect(result.onlyA).toHaveLength(0);
      expect(result.onlyB).toHaveLength(0);
      expect(result.aOracles).toHaveLength(0);
      expect(result.bOracles).toHaveLength(0);
    });
  });

  describe('empty cubes', () => {
    it('should handle both cubes being empty', async () => {
      const cardsA = { mainboard: [], maybeboard: [] };
      const cardsB = { mainboard: [], maybeboard: [] };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.inBoth).toHaveLength(0);
      expect(result.onlyA).toHaveLength(0);
      expect(result.onlyB).toHaveLength(0);
      expect(result.allCards).toHaveLength(0);
    });

    it('should handle one empty cube', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1), createComparisonCard(2)],
        maybeboard: [],
      };
      const cardsB = { mainboard: [], maybeboard: [] };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.inBoth).toHaveLength(0);
      expect(result.onlyA).toHaveLength(2);
      expect(result.onlyB).toHaveLength(0);
      expect(result.allCards).toHaveLength(2);
    });
  });

  describe('multiple copies of same card', () => {
    it('should match cards by oracle_id even with multiple copies in cube A', async () => {
      const cardsA = {
        mainboard: [
          createComparisonCard(1, 'oracle1'),
          createComparisonCard(2, 'oracle1'), // Duplicate oracle_id
          createComparisonCard(3, 'oracle2'),
        ],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(4, 'oracle1'), createComparisonCard(5, 'oracle3')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // oracle1 is in both (even though cube A has 2 copies, only one match)
      expect(result.inBoth).toHaveLength(1);
      expect(result.inBoth[0].details.oracle_id).toBe('oracle1');

      // onlyA should have oracle2 (and one oracle1 since one was matched)
      expect(result.onlyA).toHaveLength(2);
    });

    it('should match cards by oracle_id even with multiple copies in cube B', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1, 'oracle1')],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [
          createComparisonCard(2, 'oracle1'),
          createComparisonCard(3, 'oracle1'), // Duplicate oracle_id
          createComparisonCard(4, 'oracle2'),
        ],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // oracle1 is in both
      expect(result.inBoth).toHaveLength(1);
      expect(result.inBoth[0].details.oracle_id).toBe('oracle1');

      // onlyB should have one oracle1 and oracle2
      expect(result.onlyB).toHaveLength(2);
    });
  });

  describe('oracle_id comparison', () => {
    it('should compare cards by oracle_id, not card name', async () => {
      const cardsA = {
        mainboard: [
          createComparisonCard(1, 'oracle1', 'Lightning Bolt'),
          createComparisonCard(2, 'oracle2', 'Force of Will'),
        ],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [
          createComparisonCard(3, 'oracle1', 'Lightning Bolt'), // Same oracle_id, same name
          createComparisonCard(4, 'oracle3', 'Lightning Bolt'), // Different oracle_id, same name
        ],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // Only oracle1 is in both
      expect(result.inBoth).toHaveLength(1);
      expect(result.inBoth[0].details.oracle_id).toBe('oracle1');

      // onlyA has oracle2
      expect(result.onlyA).toHaveLength(1);
      expect(result.onlyA[0].details.oracle_id).toBe('oracle2');

      // onlyB has oracle3
      expect(result.onlyB).toHaveLength(1);
      expect(result.onlyB[0].details.oracle_id).toBe('oracle3');
    });
  });

  describe('return value structure', () => {
    it('should maintain card details in results', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1, 'oracle1', 'Test Card')],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(2, 'oracle1', 'Test Card')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.inBoth[0]).toHaveProperty('details');
      expect(result.inBoth[0].details).toHaveProperty('oracle_id', 'oracle1');
      expect(result.inBoth[0].details).toHaveProperty('name', 'Test Card');
    });
  });

  describe('order preservation', () => {
    it('should maintain relative order in inBoth list', async () => {
      const cardsA = {
        mainboard: [
          createComparisonCard(1, 'oracle1'),
          createComparisonCard(2, 'oracle2'),
          createComparisonCard(3, 'oracle3'),
        ],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [
          createComparisonCard(4, 'oracle3'),
          createComparisonCard(5, 'oracle1'),
          createComparisonCard(6, 'oracle2'),
        ],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // inBoth should be in the order they appear in cardsA
      expect(result.inBoth.map((c: any) => c.details.oracle_id)).toEqual(['oracle1', 'oracle2', 'oracle3']);
    });
  });

  describe('custom cards', () => {
    it('should match custom cards by custom_name when same name, case insensitive, in both cubes', async () => {
      const cardsA = {
        mainboard: [createCustomCard('My Custom Card')],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createCustomCard('My Custom Card')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // Custom cards with same custom_name should be in both
      expect(result.inBoth).toHaveLength(1);
      expect(result.inBoth[0].custom_name).toBe('My Custom Card');
    });

    it('should not match custom cards if custom_name differs', async () => {
      const cardsA = {
        mainboard: [createCustomCard('Custom Card A')],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createCustomCard('Custom Card B')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // Custom cards with different custom_names should not match
      expect(result.inBoth).toHaveLength(0);
      expect(result.onlyA).toHaveLength(1);
      expect(result.onlyB).toHaveLength(1);
    });

    it('should match multiple copies of same custom card', async () => {
      const cardsA = {
        mainboard: [
          createCustomCard('Bomb Custom'),
          createCustomCard('Bomb Custom'),
          createCustomCard('Another Custom'),
        ],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createCustomCard('Bomb Custom'), createCustomCard('Different Custom')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // One copy of 'Bomb Custom' should match
      expect(result.inBoth).toHaveLength(1);
      expect(result.inBoth[0].custom_name).toBe('Bomb Custom');

      // onlyA should have one 'Bomb Custom' and 'Another Custom'
      expect(result.onlyA).toHaveLength(2);

      // onlyB should have 'Different Custom'
      expect(result.onlyB).toHaveLength(1);
    });

    it('should mix custom cards with regular cards correctly', async () => {
      const cardsA = {
        mainboard: [
          createComparisonCard(1, 'oracle1'),
          createCustomCard('Custom A'),
          createComparisonCard(2, 'oracle2'),
        ],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [
          createComparisonCard(2, 'oracle1'),
          createCustomCard('Custom A'),
          createComparisonCard(3, 'oracle3'),
        ],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      // oracle1 matches, and custom card with same custom_name should match
      expect(result.inBoth).toHaveLength(2);
      const inBothOracleIds = result.inBoth.map((c: any) => c.details?.oracle_id).filter(Boolean);
      const inBothCustomNames = result.inBoth.map((c: any) => c.custom_name).filter(Boolean);

      expect(inBothOracleIds).toContain('oracle1');
      expect(inBothCustomNames).toContain('Custom A');
    });

    it('should handle custom card in cube A only', async () => {
      const cardsA = {
        mainboard: [createCustomCard('Only in A')],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createComparisonCard(1, 'oracle1')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.inBoth).toHaveLength(0);
      expect(result.onlyA).toHaveLength(1);
      expect(result.onlyA[0].custom_name).toBe('Only in A');
      expect(result.onlyB).toHaveLength(1);
    });

    it('should handle custom card in cube B only', async () => {
      const cardsA = {
        mainboard: [createComparisonCard(1, 'oracle1')],
        maybeboard: [],
      };
      const cardsB = {
        mainboard: [createCustomCard('Only in B')],
        maybeboard: [],
      };

      const result = await compareCubes(cardsA, cardsB);

      expect(result.inBoth).toHaveLength(0);
      expect(result.onlyA).toHaveLength(1);
      expect(result.onlyB).toHaveLength(1);
      expect(result.onlyB[0].custom_name).toBe('Only in B');
    });
  });
});
