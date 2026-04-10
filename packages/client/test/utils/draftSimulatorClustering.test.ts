import { computeSkeletons, euclidSq, kMeans } from '../../src/utils/draftSimulatorClustering';

const makeMeta = (id: string, type = 'Creature', colorIdentity: string[] = []) => ({
  name: id,
  imageUrl: '',
  colorIdentity,
  elo: 1200,
  cmc: 2,
  type,
});

const makePool = (draftIndex: number, seatIndex: number, cardIds: string[]) => ({
  draftIndex,
  seatIndex,
  archetype: 'C',
  picks: cardIds.map((id) => ({ oracle_id: id, packNumber: 0, pickNumber: 1 })),
});

// ---------------------------------------------------------------------------
// euclidSq
// ---------------------------------------------------------------------------
describe('euclidSq', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclidSq([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct squared distance', () => {
    expect(euclidSq([0, 0], [3, 4])).toBe(25);
  });

  it('treats missing entries as 0', () => {
    expect(euclidSq([1], [1, 0])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// kMeans
// ---------------------------------------------------------------------------
describe('kMeans', () => {
  it('returns [] for empty input', () => {
    expect(kMeans([], 3)).toEqual([]);
  });

  it('clamps k to the number of vectors', () => {
    const vecs = [
      [1, 0],
      [0, 1],
    ];
    const result = kMeans(vecs, 10); // k=10 but only 2 points
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBeLessThanOrEqual(2);
  });

  it('assigns all points to cluster 0 when k=1', () => {
    const vecs = [
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const result = kMeans(vecs, 1);
    expect(result.every((a) => a === 0)).toBe(true);
  });

  it('separates two clearly distinct groups', () => {
    const vecs = [
      [0, 0],
      [0.1, 0],
      [0, 0.1], // cluster A — near origin
      [10, 10],
      [10.1, 10],
      [10, 10.1], // cluster B — far corner
    ];
    const result = kMeans(vecs, 2);
    expect(result).toHaveLength(6);
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
    expect(result[3]).toBe(result[4]);
    expect(result[4]).toBe(result[5]);
    expect(result[0]).not.toBe(result[3]);
  });

  it('returns one assignment per input vector', () => {
    const vecs = Array.from({ length: 20 }, (_, i) => [i % 4, Math.floor(i / 4)]);
    const result = kMeans(vecs, 4);
    expect(result).toHaveLength(20);
    for (const a of result) expect(a).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// computeSkeletons
// ---------------------------------------------------------------------------
describe('computeSkeletons', () => {
  it('returns [] for empty pools', () => {
    expect(computeSkeletons([], {}, 4)).toEqual([]);
  });

  it('clamps k to the number of pools', () => {
    const meta = { a: makeMeta('a'), b: makeMeta('b') };
    const pools = [makePool(0, 0, ['a']), makePool(0, 1, ['b'])];
    const result = computeSkeletons(pools, meta, 10);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('excludes basic lands from card vectors', () => {
    const meta = {
      spell: makeMeta('spell', 'Creature', ['U']),
      island: makeMeta('island', 'Basic Land', ['U']),
    };
    const pools = [makePool(0, 0, ['spell', 'island']), makePool(0, 1, ['spell', 'island'])];
    const result = computeSkeletons(pools, meta, 1);
    expect(result).toHaveLength(1);
    const allCardIds = result.flatMap((s) => [...s.coreCards, ...s.occasionalCards].map((c) => c.oracle_id));
    expect(allCardIds).not.toContain('island');
  });

  it('identifies a card in every pool as a core card', () => {
    const meta = { staple: makeMeta('staple', 'Creature', ['U']) };
    const pools = Array.from({ length: 5 }, (_, i) => makePool(0, i, ['staple']));
    const result = computeSkeletons(pools, meta, 1, 60);
    expect(result).toHaveLength(1);
    expect(result[0].coreCards.map((c) => c.oracle_id)).toContain('staple');
  });

  it('sorts skeletons by pool count descending', () => {
    const meta = { a: makeMeta('a', 'Creature', ['R']), b: makeMeta('b', 'Creature', ['G']) };
    const pools = [
      ...Array.from({ length: 5 }, (_, i) => makePool(0, i, ['a'])),
      ...Array.from({ length: 2 }, (_, i) => makePool(1, i, ['b'])),
    ];
    const result = computeSkeletons(pools, meta, 2, 60);
    if (result.length >= 2) {
      expect(result[0].poolCount).toBeGreaterThanOrEqual(result[1].poolCount);
    }
  });

  it('includes common sideboard-only cards when deck builds are available', () => {
    const meta = {
      core: makeMeta('core', 'Creature', ['G']),
      side: makeMeta('side', 'Instant', ['U']),
      maindeck: makeMeta('maindeck', 'Sorcery', ['R']),
    };
    const pools = [
      makePool(0, 0, ['core', 'side', 'maindeck']),
      makePool(0, 1, ['core', 'side', 'maindeck']),
      makePool(0, 2, ['core', 'side', 'maindeck']),
      makePool(0, 3, ['core', 'side', 'maindeck']),
    ];
    const deckBuilds = [
      { mainboard: ['core', 'maindeck'], sideboard: ['side'] },
      { mainboard: ['core', 'maindeck'], sideboard: ['side'] },
      { mainboard: ['core', 'maindeck'], sideboard: ['side'] },
      { mainboard: ['core', 'maindeck'], sideboard: ['side'] },
    ];

    const result = computeSkeletons(pools, meta, 1, 60, deckBuilds);

    expect(result).toHaveLength(1);
    expect(result[0]?.sideboardCards.map((card) => card.oracle_id)).toContain('side');
    expect(result[0]?.sideboardCards.find((card) => card.oracle_id === 'side')?.fraction).toBe(1);
  });
});
