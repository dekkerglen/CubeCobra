import { approximateUmap, buildKnnGraph, computeSkeletons, cosineDist, euclidSq, hdbscanAssignments, leidenAssignments, nmfAssignments } from '../../src/utils/draftSimulatorClustering';

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
// hdbscanAssignments
// ---------------------------------------------------------------------------
describe('hdbscanAssignments', () => {
  it('returns [] for empty input', () => {
    expect(hdbscanAssignments([], 3)).toEqual([]);
  });

  it('returns [0] for a single point', () => {
    expect(hdbscanAssignments([[1, 2]], 3)).toEqual([0]);
  });

  it('assigns all points to cluster 0 when everything is close', () => {
    const vecs = [
      [0, 0],
      [0.1, 0],
      [0, 0.1],
      [0.1, 0.1],
    ];
    const result = hdbscanAssignments(vecs, 2);
    expect(result).toHaveLength(4);
    // All same cluster
    expect(new Set(result).size).toBe(1);
  });

  it('separates two clearly distinct groups', () => {
    const vecs = [
      [0, 0],
      [0.1, 0],
      [0, 0.1],
      [0.1, 0.1], // cluster A — near origin
      [20, 20],
      [20.1, 20],
      [20, 20.1],
      [20.1, 20.1], // cluster B — far corner
    ];
    const result = hdbscanAssignments(vecs, 2);
    expect(result).toHaveLength(8);
    // First four should be same cluster
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
    expect(result[2]).toBe(result[3]);
    // Last four should be same cluster
    expect(result[4]).toBe(result[5]);
    expect(result[5]).toBe(result[6]);
    expect(result[6]).toBe(result[7]);
    // The two groups should be different clusters
    expect(result[0]).not.toBe(result[4]);
  });

  it('returns one assignment per input vector', () => {
    const vecs = Array.from({ length: 20 }, (_, i) => [i % 4, Math.floor(i / 4)]);
    const result = hdbscanAssignments(vecs, 3);
    expect(result).toHaveLength(20);
    for (const a of result) expect(a).toBeGreaterThanOrEqual(0);
  });

  it('treats small groups as noise and assigns to nearest cluster', () => {
    // Two big clusters + 1 isolated point
    const vecs = [
      ...Array.from({ length: 5 }, (_, i) => [i * 0.1, 0]),   // cluster near origin
      ...Array.from({ length: 5 }, (_, i) => [10 + i * 0.1, 10]), // cluster far away
      [0.2, 0.1], // isolated but close to cluster A
    ];
    const result = hdbscanAssignments(vecs, 4);
    expect(result).toHaveLength(11);
    // The isolated point should be assigned to cluster A (same as first 5 points)
    expect(result[10]).toBe(result[0]);
  });

  it('produces a reasonable number of clusters with high-dim data', () => {
    // 3 well-separated clusters of 10 points each in 10-dim space
    const vecs: number[][] = [];
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 10; i++) {
        const v = new Array(10).fill(0);
        v[c * 3] = 10 + i * 0.1;         // each cluster is far apart in a different dimension
        v[c * 3 + 1] = i * 0.1;
        vecs.push(v);
      }
    }
    const result = hdbscanAssignments(vecs, 5);
    expect(result).toHaveLength(30);
    const numClusters = new Set(result).size;
    // Should find roughly 3 clusters, not 30
    expect(numClusters).toBeGreaterThanOrEqual(2);
    expect(numClusters).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// approximateUmap
// ---------------------------------------------------------------------------
describe('approximateUmap', () => {
  it('returns [] for empty input', () => {
    expect(approximateUmap([])).toEqual([]);
  });

  it('returns coordinates for each input vector', () => {
    const vecs = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
      [0, 1, 1],
    ];
    const result = approximateUmap(vecs);
    expect(result).toHaveLength(5);
    for (const coord of result) {
      expect(typeof coord.x).toBe('number');
      expect(typeof coord.y).toBe('number');
      expect(Number.isFinite(coord.x)).toBe(true);
      expect(Number.isFinite(coord.y)).toBe(true);
    }
  });

  it('handles fewer than 3 points gracefully', () => {
    const vecs = [
      [1, 2],
      [3, 4],
    ];
    const result = approximateUmap(vecs);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// computeSkeletons (UMAP-Nd + HDBSCAN)
// ---------------------------------------------------------------------------
describe('computeSkeletons', () => {
  it('returns empty for empty pools', () => {
    const result = computeSkeletons([], {}, null);
    expect(result.skeletons).toEqual([]);
    expect(result.umapCoords).toEqual([]);
  });

  it('handles more pools than minClusterSize gracefully', () => {
    const meta = { a: makeMeta('a'), b: makeMeta('b') };
    const pools = [makePool(0, 0, ['a']), makePool(0, 1, ['b'])];
    const result = computeSkeletons(pools, meta, null);
    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes basic lands from card vectors', () => {
    const meta = {
      spell: makeMeta('spell', 'Creature', ['U']),
      island: makeMeta('island', 'Basic Land', ['U']),
    };
    const pools = [makePool(0, 0, ['spell', 'island']), makePool(0, 1, ['spell', 'island'])];
    const result = computeSkeletons(pools, meta, null);
    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);
    const allCardIds = result.skeletons.flatMap((s) =>
      [...s.coreCards.default, ...s.occasionalCards].map((c) => c.oracle_id),
    );
    expect(allCardIds).not.toContain('island');
  });

  it('identifies a card in every pool as a core card', () => {
    const meta = { staple: makeMeta('staple', 'Creature', ['U']) };
    const pools = Array.from({ length: 5 }, (_, i) => makePool(0, i, ['staple']));
    const result = computeSkeletons(pools, meta, null);
    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);
    const hasStaple = result.skeletons.some((s) => s.coreCards.default.some((c) => c.oracle_id === 'staple'));
    expect(hasStaple).toBe(true);
  });

  it('sorts skeletons by pool count descending', () => {
    const meta = { a: makeMeta('a', 'Creature', ['R']), b: makeMeta('b', 'Creature', ['G']) };
    const pools = [
      ...Array.from({ length: 5 }, (_, i) => makePool(0, i, ['a'])),
      ...Array.from({ length: 2 }, (_, i) => makePool(1, i, ['b'])),
    ];
    const result = computeSkeletons(pools, meta, null);
    if (result.skeletons.length >= 2) {
      expect(result.skeletons[0].poolCount).toBeGreaterThanOrEqual(result.skeletons[1].poolCount);
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

    const result = computeSkeletons(pools, meta, null, deckBuilds);

    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);
    const hasSide = result.skeletons.some((s) => s.sideboardCards.some((c) => c.oracle_id === 'side'));
    expect(hasSide).toBe(true);
  });

  it('returns umapCoords matching the number of pools', () => {
    const meta = { a: makeMeta('a'), b: makeMeta('b'), c: makeMeta('c') };
    const pools = [makePool(0, 0, ['a']), makePool(0, 1, ['b']), makePool(0, 2, ['c'])];
    const result = computeSkeletons(pools, meta, null);
    expect(result.umapCoords).toHaveLength(3);
    for (const coord of result.umapCoords) {
      expect(typeof coord.x).toBe('number');
      expect(typeof coord.y).toBe('number');
    }
  });

  it('uses provided embeddings when available', () => {
    const meta = { a: makeMeta('a'), b: makeMeta('b'), c: makeMeta('c') };
    const pools = [makePool(0, 0, ['a']), makePool(0, 1, ['b']), makePool(0, 2, ['c'])];
    const embeddings = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
    ];
    const result = computeSkeletons(pools, meta, embeddings);
    expect(result.skeletons.length).toBeGreaterThan(0);
    expect(result.umapCoords).toHaveLength(3);
  });

  it('supports custom leiden graph parameters', () => {
    const meta = { a: makeMeta('a'), b: makeMeta('b') };
    const pools = [makePool(0, 0, ['a']), makePool(0, 1, ['b']), makePool(0, 2, ['a', 'b'])];
    const result = computeSkeletons(pools, meta, null, null, 12, 10, 1.5);
    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);
    expect(result.clusterMethod).toContain('leiden');
  });

  it('uses leiden clustering', () => {
    const meta = { a: makeMeta('a', 'Creature', ['R']), b: makeMeta('b', 'Creature', ['G']), c: makeMeta('c', 'Creature', ['U']) };
    const pools = [
      ...Array.from({ length: 4 }, (_, i) => makePool(0, i, ['a'])),
      ...Array.from({ length: 4 }, (_, i) => makePool(1, i, ['b'])),
    ];
    const result = computeSkeletons(pools, meta, null, null, 50, 20, 1.0);
    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);
    expect(result.umapCoords).toHaveLength(8);
    expect(result.clusterMethod).toContain('leiden');
  });

  it('populates distinctCards disjoint from coreCards and from other clusters distinctCards', () => {
    const meta = {
      sharedA: makeMeta('sharedA', 'Creature', ['U']),
      sharedB: makeMeta('sharedB', 'Creature', ['U']),
      onlyA1: makeMeta('onlyA1', 'Creature', ['R']),
      onlyA2: makeMeta('onlyA2', 'Creature', ['R']),
      onlyB1: makeMeta('onlyB1', 'Creature', ['G']),
      onlyB2: makeMeta('onlyB2', 'Creature', ['G']),
    };
    const pools = [
      makePool(0, 0, ['sharedA', 'sharedB', 'onlyA1', 'onlyA2']),
      makePool(0, 1, ['sharedA', 'sharedB', 'onlyA1', 'onlyA2']),
      makePool(0, 2, ['sharedA', 'sharedB', 'onlyA1', 'onlyA2']),
      makePool(1, 0, ['sharedA', 'sharedB', 'onlyB1', 'onlyB2']),
      makePool(1, 1, ['sharedA', 'sharedB', 'onlyB1', 'onlyB2']),
      makePool(1, 2, ['sharedA', 'sharedB', 'onlyB1', 'onlyB2']),
    ];
    const embeddings = [
      [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0],
      [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0],
    ];
    const result = computeSkeletons(pools, meta, embeddings);
    expect(result.skeletons.length).toBeGreaterThanOrEqual(1);

    const allDistinctIds: string[] = [];
    for (const skel of result.skeletons) {
      expect(skel.distinctCards).toBeDefined();
      const coreDefaultIds = new Set(skel.coreCards.default.map((c) => c.oracle_id));
      const coreFixingIds = new Set(skel.coreCards.excludingFixing.map((c) => c.oracle_id));
      for (const c of skel.distinctCards!.default) expect(coreDefaultIds.has(c.oracle_id)).toBe(false);
      for (const c of skel.distinctCards!.excludingFixing) expect(coreFixingIds.has(c.oracle_id)).toBe(false);
      for (const c of skel.distinctCards!.default) allDistinctIds.push(c.oracle_id);
    }
    // No card should appear in more than one cluster's distinct (default) tab.
    expect(allDistinctIds.length).toBe(new Set(allDistinctIds).size);
  });

  it('returns empty distinctCards when no embeddings are supplied', () => {
    const meta = { a: makeMeta('a'), b: makeMeta('b') };
    const pools = [makePool(0, 0, ['a']), makePool(0, 1, ['b'])];
    const result = computeSkeletons(pools, meta, null);
    for (const skel of result.skeletons) {
      expect(skel.distinctCards).toEqual({ default: [], excludingFixing: [] });
    }
  });
});

// ---------------------------------------------------------------------------
// cosineDist
// ---------------------------------------------------------------------------
describe('cosineDist', () => {
  it('returns 0 for identical vectors', () => {
    expect(cosineDist([1, 2, 3], [1, 2, 3])).toBeCloseTo(0);
  });

  it('returns 1 for orthogonal vectors', () => {
    expect(cosineDist([1, 0], [0, 1])).toBeCloseTo(1);
  });

  it('returns ~2 for opposite vectors', () => {
    expect(cosineDist([1, 0], [-1, 0])).toBeCloseTo(2);
  });

  it('returns 1 for zero vector', () => {
    expect(cosineDist([0, 0], [1, 2])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// leidenAssignments
// ---------------------------------------------------------------------------
describe('leidenAssignments', () => {
  it('returns [] for empty graph', () => {
    const graph = buildKnnGraph([], 5);
    expect(leidenAssignments(graph, 0)).toEqual([]);
  });

  it('returns [0] for single point', () => {
    const graph = { edges: [], neighbors: [[]] };
    expect(leidenAssignments(graph, 1)).toEqual([0]);
  });

  it('separates two distinct groups', () => {
    const vecs = [
      [0, 0], [0.1, 0], [0, 0.1], [0.1, 0.1],
      [10, 10], [10.1, 10], [10, 10.1], [10.1, 10.1],
    ];
    const graph = buildKnnGraph(vecs, 3);
    // Use deterministic rng
    let seed = 42;
    const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const result = leidenAssignments(graph, 8, 1.0, rng);
    expect(result).toHaveLength(8);
    // First four should be in the same community
    const groupA = result[0];
    expect(result.slice(0, 4).every((r) => r === groupA)).toBe(true);
    // Last four should be in the same community
    const groupB = result[4];
    expect(result.slice(4).every((r) => r === groupB)).toBe(true);
    // The two groups should differ
    expect(groupA).not.toBe(groupB);
  });

  it('higher resolution produces more communities', () => {
    const vecs = [
      [0, 0], [0.5, 0], [1, 0],
      [5, 0], [5.5, 0], [6, 0],
      [10, 0], [10.5, 0], [11, 0],
    ];
    const graph = buildKnnGraph(vecs, 4);
    const lowRes = new Set(leidenAssignments(graph, 9, 0.1)).size;
    const highRes = new Set(leidenAssignments(graph, 9, 5.0)).size;
    expect(highRes).toBeGreaterThanOrEqual(lowRes);
  });
});

// ---------------------------------------------------------------------------
// nmfAssignments
// ---------------------------------------------------------------------------
describe('nmfAssignments', () => {
  it('returns all zeros for empty matrix', () => {
    expect(nmfAssignments([], 3)).toEqual([]);
  });

  it('assigns each deck to a topic', () => {
    const matrix = [
      new Uint8Array([1, 1, 0, 0]),
      new Uint8Array([1, 0, 1, 0]),
      new Uint8Array([0, 0, 1, 1]),
      new Uint8Array([0, 1, 0, 1]),
    ];
    const result = nmfAssignments(matrix, 2, 50);
    expect(result).toHaveLength(4);
    for (const a of result) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(2);
    }
  });

  it('separates clearly distinct card patterns', () => {
    // Group A: cards 0-4, Group B: cards 5-9
    const matrix = [
      ...Array.from({ length: 5 }, () => {
        const v = new Uint8Array(10);
        for (let j = 0; j < 5; j++) v[j] = 1;
        return v;
      }),
      ...Array.from({ length: 5 }, () => {
        const v = new Uint8Array(10);
        for (let j = 5; j < 10; j++) v[j] = 1;
        return v;
      }),
    ];
    const result = nmfAssignments(matrix, 2, 100);
    expect(result).toHaveLength(10);
    // All of group A should share a topic
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
    // All of group B should share a topic
    expect(result[5]).toBe(result[6]);
    expect(result[6]).toBe(result[7]);
    // Groups should be different
    expect(result[0]).not.toBe(result[5]);
  });
});
