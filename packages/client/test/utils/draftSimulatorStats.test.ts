import type {
  CardMeta,
  CardStats,
  SimulationRunData,
  SimulationSetupResponse,
} from '@utils/datatypes/SimulationReport';

import { computeFilteredCardStats } from '../../src/utils/draftSimulatorStats';

const makeCardMeta = (name: string): CardMeta => ({
  name,
  imageUrl: '',
  colorIdentity: [],
  elo: 1200,
  cmc: 1,
  type: 'Creature',
});

const makeCardStats = (oracleId: string, poolIndices: number[]): CardStats => ({
  oracle_id: oracleId,
  name: oracleId,
  colorIdentity: [],
  timesSeen: 1,
  timesPicked: poolIndices.length,
  pickRate: poolIndices.length > 0 ? 1 : 0,
  avgPickPosition: 1,
  wheelCount: 0,
  p1p1Count: poolIndices.length,
  p1p1Seen: 1,
  poolIndices,
  elo: 1200,
});

const baseRunData = (
  overrides: Partial<SimulationRunData> = {},
  cardMeta: Record<string, CardMeta> = {},
): SimulationRunData => ({
  cubeId: 'cube',
  cubeName: 'Cube',
  numDrafts: 1,
  numSeats: 1,
  cardStats: [],
  archetypeDistribution: [],
  convergenceScore: 0,
  generatedAt: '2026-01-01T00:00:00.000Z',
  cardMeta,
  slimPools: [],
  ...overrides,
});

describe('computeFilteredCardStats', () => {
  it('recomputes stats only for the selected pool set', () => {
    const setup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> = {
      initialPacks: [
        [
          [['a', 'b']],
          [['c', 'd']],
        ],
      ],
      packSteps: [[{ action: 'pick', amount: 1 }]],
      numSeats: 2,
    };

    const runData = baseRunData(
      {
        numSeats: 2,
        slimPools: [
          {
            draftIndex: 0,
            seatIndex: 0,
            archetype: 'C',
            picks: [{ oracle_id: 'a', packNumber: 0, pickNumber: 1 }],
          },
          {
            draftIndex: 0,
            seatIndex: 1,
            archetype: 'C',
            picks: [{ oracle_id: 'd', packNumber: 0, pickNumber: 1 }],
          },
        ],
        cardStats: [makeCardStats('a', [0]), makeCardStats('b', []), makeCardStats('c', [1]), makeCardStats('d', [1])],
      },
      {
        a: makeCardMeta('a'),
        b: makeCardMeta('b'),
        c: makeCardMeta('c'),
        d: makeCardMeta('d'),
      },
    );

    const result = computeFilteredCardStats(setup, runData, new Set([0]));

    expect(result.map((card) => card.oracle_id)).toEqual(['a', 'b']);
    expect(result.find((card) => card.oracle_id === 'a')).toMatchObject({
      timesSeen: 1,
      timesPicked: 1,
      pickRate: 1,
      avgPickPosition: 1,
      p1p1Count: 1,
      p1p1Seen: 1,
      poolIndices: [0],
    });
    expect(result.find((card) => card.oracle_id === 'b')).toMatchObject({
      timesSeen: 1,
      timesPicked: 0,
      pickRate: 0,
      poolIndices: [],
    });
  });

  it('handles trashrandom using recorded randomTrashByPool data', () => {
    const setup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> = {
      initialPacks: [[[['a', 'b']]]],
      packSteps: [[{ action: 'trashrandom', amount: 1 }, { action: 'pick', amount: 1 }]],
      numSeats: 1,
    };

    const runData = baseRunData(
      {
        slimPools: [
          {
            draftIndex: 0,
            seatIndex: 0,
            archetype: 'C',
            picks: [{ oracle_id: 'b', packNumber: 0, pickNumber: 2 }],
          },
        ],
        randomTrashByPool: [['a']],
        cardStats: [makeCardStats('a', []), makeCardStats('b', [0])],
      },
      { a: makeCardMeta('a'), b: makeCardMeta('b') },
    );

    const result = computeFilteredCardStats(setup, runData, new Set([0]));

    expect(result.find((card) => card.oracle_id === 'a')).toMatchObject({
      timesSeen: 1,
      timesPicked: 0,
    });
    expect(result.find((card) => card.oracle_id === 'b')).toMatchObject({
      timesSeen: 2,
      timesPicked: 1,
      avgPickPosition: 2,
      pickRate: 0.5,
      poolIndices: [0],
    });
  });

  it('falls back to stored card stats when trashrandom replay data is missing', () => {
    const setup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> = {
      initialPacks: [[[['a', 'b']]]],
      packSteps: [[{ action: 'trashrandom', amount: 1 }]],
      numSeats: 1,
    };

    const fallbackStats = [makeCardStats('a', [0]), makeCardStats('b', [])];
    const runData = baseRunData(
      {
        slimPools: [
          {
            draftIndex: 0,
            seatIndex: 0,
            archetype: 'C',
            picks: [],
          },
        ],
        cardStats: fallbackStats,
      },
      { a: makeCardMeta('a'), b: makeCardMeta('b') },
    );

    expect(computeFilteredCardStats(setup, runData, new Set([0]))).toEqual([fallbackStats[0]]);
  });
});
