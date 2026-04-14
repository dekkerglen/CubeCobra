/* eslint-disable camelcase, no-plusplus, no-restricted-syntax */

import {
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  LockPair,
  SkeletonCard,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

// ---------------------------------------------------------------------------
// Euclidean distance helpers
// ---------------------------------------------------------------------------

export function euclidSq(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
  return s;
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(euclidSq(a, b));
}

// ---------------------------------------------------------------------------
// k-means fallback for uniform-density data
// ---------------------------------------------------------------------------

/**
 * Simple k-means++ seeded k-means. Used as a fallback when HDBSCAN sees
 * uniform density and collapses everything into one cluster.
 */
function kmeansAssignments(vectors: number[][], k: number, maxIter = 30): number[] {
  const n = vectors.length;
  const dim = vectors[0]?.length ?? 0;
  if (n === 0 || k <= 0) return [];
  if (k >= n) return vectors.map((_, i) => i);

  // k-means++ initialisation
  const centroids: number[][] = [];
  const firstIdx = Math.floor(Math.random() * n);
  centroids.push([...vectors[firstIdx]!]);

  for (let c = 1; c < k; c++) {
    const dists = vectors.map((v) => {
      let minD = Infinity;
      for (const cent of centroids) minD = Math.min(minD, euclidSq(v, cent));
      return minD;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    let picked = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i]!;
      if (r <= 0) { picked = i; break; }
    }
    centroids.push([...vectors[picked]!]);
  }

  const assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclidSq(vectors[i]!, centroids[c]!);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const newCent = new Array<number>(dim).fill(0);
      let count = 0;
      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) {
          for (let d = 0; d < dim; d++) newCent[d] += vectors[i]![d]!;
          count++;
        }
      }
      if (count > 0) {
        for (let d = 0; d < dim; d++) newCent[d] /= count;
        centroids[c] = newCent;
      }
    }
  }

  // Renumber so cluster IDs are 0-based contiguous
  const seen = new Map<number, number>();
  let nextId = 0;
  return assignments.map((a) => {
    if (!seen.has(a)) seen.set(a, nextId++);
    return seen.get(a)!;
  });
}

// ---------------------------------------------------------------------------
// Full HDBSCAN with mutual reachability distances
// ---------------------------------------------------------------------------

/**
 * A cluster in the HDBSCAN condensed tree.
 * Stability measures how persistent a cluster is across density levels.
 */
interface CondensedCluster {
  id: number;
  birthLambda: number;     // 1/distance where this cluster was born
  childIds: number[];      // IDs of child condensed clusters (0 or 2)
  stability: number;       // accumulated stability (higher = more persistent)
  selected: boolean;       // whether this cluster is part of the final flat extraction
  allPointIndices: number[]; // all original point indices in this cluster's subtree
}

/**
 * Run full HDBSCAN on arbitrary-dimensional vectors and return flat cluster
 * assignments using mutual reachability distances + condensed-tree + stability.
 *
 * 1. Compute core distances (distance to the minPts-th nearest neighbor).
 * 2. Build a minimum spanning tree using mutual reachability distances
 *    d_mreach(a,b) = max(core(a), core(b), d(a,b)) via Prim's algorithm.
 * 3. Sort MST edges and build a single-linkage dendrogram (union-find).
 * 4. Condense the dendrogram: walk top-down, collapsing noise ejections.
 * 5. Select clusters via bottom-up stability comparison.
 * 6. Assign every point to its selected cluster; noise to nearest centroid.
 *
 * @param vectors   High-dimensional vectors (one per data point)
 * @param minClusterSize  Minimum points for a group to be a cluster
 * @returns An array of cluster indices (0-based), one per input point.
 */
export function hdbscanAssignments(
  vectors: number[][],
  minClusterSize: number,
): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  // minPts controls density smoothing (core distance = distance to minPts-th neighbor).
  // Keep it small and independent of minClusterSize so that density estimation
  // stays sensitive even when the user requests larger clusters.
  const minPts = Math.min(3, n - 1);

  // -----------------------------------------------------------------------
  // Step 1: Compute core distances
  // -----------------------------------------------------------------------
  // For each point, the distance to its minPts-th nearest neighbor.
  const coreDist = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dists = new Float64Array(n - 1);
    let idx = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) dists[idx++] = euclidean(vectors[i]!, vectors[j]!);
    }
    dists.sort();
    coreDist[i] = dists[Math.min(minPts - 1, dists.length - 1)]!;
  }

  // Mutual reachability distance
  function mreach(i: number, j: number): number {
    return Math.max(coreDist[i]!, coreDist[j]!, euclidean(vectors[i]!, vectors[j]!));
  }

  // -----------------------------------------------------------------------
  // Step 2: Build MST via Prim's algorithm with mutual reachability
  // -----------------------------------------------------------------------
  interface MSTEdge { i: number; j: number; dist: number }
  const mstEdges: MSTEdge[] = [];
  const inMST = new Uint8Array(n);
  const minEdgeDist = new Float64Array(n).fill(Infinity);
  const minEdgeFrom = new Int32Array(n).fill(-1);

  inMST[0] = 1;
  for (let j = 1; j < n; j++) {
    minEdgeDist[j] = mreach(0, j);
    minEdgeFrom[j] = 0;
  }

  for (let step = 1; step < n; step++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!inMST[j] && minEdgeDist[j]! < bestDist) {
        bestDist = minEdgeDist[j]!;
        bestIdx = j;
      }
    }
    if (bestIdx < 0) break;

    inMST[bestIdx] = 1;
    mstEdges.push({ i: minEdgeFrom[bestIdx]!, j: bestIdx, dist: bestDist });

    for (let j = 0; j < n; j++) {
      if (inMST[j]) continue;
      const d = mreach(bestIdx, j);
      if (d < minEdgeDist[j]!) {
        minEdgeDist[j] = d;
        minEdgeFrom[j] = bestIdx;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Step 3: Sort MST edges by distance → build single-linkage dendrogram
  // -----------------------------------------------------------------------
  mstEdges.sort((a, b) => a.dist - b.dist);

  // Dendrogram: nodes 0..n-1 are leaves, internal nodes appended as merges.
  const dendroLeft: number[] = new Array(n).fill(-1);
  const dendroRight: number[] = new Array(n).fill(-1);
  const dendroDist: number[] = new Array(n).fill(0);
  const dendroSize: number[] = new Array(n).fill(1);

  // Union-find
  const ufParent = Int32Array.from({ length: n }, (_, i) => i);
  const ufRank = new Uint8Array(n);
  const ufDendroNode = Int32Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    let r = x;
    while (ufParent[r] !== r) r = ufParent[r]!;
    while (ufParent[x] !== r) { const next = ufParent[x]!; ufParent[x] = r; x = next; }
    return r;
  }

  for (const edge of mstEdges) {
    const ri = find(edge.i);
    const rj = find(edge.j);
    if (ri === rj) continue;

    const leftNode = ufDendroNode[ri]!;
    const rightNode = ufDendroNode[rj]!;
    const newIdx = dendroLeft.length;
    dendroLeft.push(leftNode);
    dendroRight.push(rightNode);
    dendroDist.push(edge.dist);
    dendroSize.push(dendroSize[leftNode]! + dendroSize[rightNode]!);

    if (ufRank[ri]! < ufRank[rj]!) {
      ufParent[ri] = rj;
      ufDendroNode[rj] = newIdx;
    } else if (ufRank[ri]! > ufRank[rj]!) {
      ufParent[rj] = ri;
      ufDendroNode[ri] = newIdx;
    } else {
      ufParent[rj] = ri;
      ufRank[ri]!++;
      ufDendroNode[ri] = newIdx;
    }
  }

  const treeRoot = dendroLeft.length - 1;

  // Helper: collect all original point indices in a dendrogram subtree
  function collectPoints(rootIdx: number): number[] {
    const result: number[] = [];
    const stack = [rootIdx];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (idx < n) { result.push(idx); continue; }
      stack.push(dendroLeft[idx]!);
      stack.push(dendroRight[idx]!);
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Step 4: Build condensed tree + accumulate stability
  // -----------------------------------------------------------------------
  const condensed: CondensedCluster[] = [];
  condensed.push({
    id: 0, birthLambda: 0, childIds: [], stability: 0,
    selected: false, allPointIndices: [],
  });

  // Iterative walk — only recurse at real splits (bounded depth = condensed tree height)
  function walk(startNodeIdx: number, startClusterId: number): void {
    // Use an explicit work-stack for the recursion at real splits
    const workStack: [number, number][] = [[startNodeIdx, startClusterId]];

    while (workStack.length > 0) {
      const [initialNodeIdx, clusterId] = workStack.pop()!;
      let nodeIdx = initialNodeIdx;
      const cluster = condensed[clusterId]!;

      // Iterate through noise ejections (tail-call style)
      while (true) {
        if (nodeIdx < n) {
          // Leaf node — single point persists in this cluster
          cluster.allPointIndices.push(nodeIdx);
          break;
        }

        const dist = dendroDist[nodeIdx]!;
        const lambda = dist > 1e-10 ? 1 / dist : 1e10;
        const leftIdx = dendroLeft[nodeIdx]!;
        const rightIdx = dendroRight[nodeIdx]!;
        const leftSize = dendroSize[leftIdx]!;
        const rightSize = dendroSize[rightIdx]!;
        const leftBig = leftSize >= minClusterSize;
        const rightBig = rightSize >= minClusterSize;

        if (leftBig && rightBig) {
          // ---- Real split: cluster dies, two children born ----
          cluster.stability += (lambda - cluster.birthLambda) * (leftSize + rightSize);

          const leftCId = condensed.length;
          condensed.push({
            id: leftCId, birthLambda: lambda, childIds: [], stability: 0,
            selected: false, allPointIndices: [],
          });
          const rightCId = condensed.length;
          condensed.push({
            id: rightCId, birthLambda: lambda, childIds: [], stability: 0,
            selected: false, allPointIndices: [],
          });
          cluster.childIds = [leftCId, rightCId];

          // Process both children via the work stack
          workStack.push([leftIdx, leftCId]);
          workStack.push([rightIdx, rightCId]);
          break; // done with this (nodeIdx, clusterId)
        } else if (leftBig) {
          // Right is noise — eject and continue with left
          cluster.stability += (lambda - cluster.birthLambda) * rightSize;
          cluster.allPointIndices.push(...collectPoints(rightIdx));
          nodeIdx = leftIdx;
        } else if (rightBig) {
          // Left is noise — eject and continue with right
          cluster.stability += (lambda - cluster.birthLambda) * leftSize;
          cluster.allPointIndices.push(...collectPoints(leftIdx));
          nodeIdx = rightIdx;
        } else {
          // Neither big enough — all points exit here
          cluster.stability += (lambda - cluster.birthLambda) * (leftSize + rightSize);
          cluster.allPointIndices.push(...collectPoints(nodeIdx));
          break;
        }
      }
    }

    // Post-pass: propagate allPointIndices up to parent condensed clusters
    for (let i = condensed.length - 1; i >= 0; i--) {
      const c = condensed[i]!;
      for (const childId of c.childIds) {
        c.allPointIndices.push(...condensed[childId]!.allPointIndices);
      }
    }
  }

  walk(treeRoot, 0);

  // -----------------------------------------------------------------------
  // Step 5: Bottom-up stability selection
  // -----------------------------------------------------------------------
  function selectClusters(cId: number): number {
    const c = condensed[cId]!;
    if (c.childIds.length === 0) {
      c.selected = true;
      return c.stability;
    }
    const childStabilitySum = c.childIds.reduce(
      (sum, childId) => sum + selectClusters(childId),
      0,
    );
    if (childStabilitySum > c.stability) {
      c.selected = false;
      return childStabilitySum;
    }
    c.selected = true;
    function deselectSubtree(id: number): void {
      const node = condensed[id]!;
      node.selected = false;
      for (const childId of node.childIds) deselectSubtree(childId);
    }
    for (const childId of c.childIds) deselectSubtree(childId);
    return c.stability;
  }

  selectClusters(0);

  // -----------------------------------------------------------------------
  // Step 6: Assign points to selected clusters
  // -----------------------------------------------------------------------
  const dim = vectors[0]?.length ?? 0;
  const assignments = new Array<number>(n).fill(-1);
  const selectedClusters: CondensedCluster[] = condensed.filter((c) => c.selected);

  if (selectedClusters.length === 0) {
    return new Array<number>(n).fill(0);
  }

  const centroids: number[][] = [];
  for (let sc = 0; sc < selectedClusters.length; sc++) {
    const indices = selectedClusters[sc]!.allPointIndices;
    const centroid = new Array<number>(dim).fill(0);
    for (const idx of indices) {
      for (let d = 0; d < dim; d++) centroid[d] += vectors[idx]![d]!;
    }
    if (indices.length > 0) {
      for (let d = 0; d < dim; d++) centroid[d] /= indices.length;
    }
    centroids.push(centroid);
    for (const idx of indices) assignments[idx] = sc;
  }

  // Assign noise points to nearest selected cluster centroid
  for (let i = 0; i < n; i++) {
    if (assignments[i] >= 0) continue;
    let bestCluster = 0;
    let bestDist = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const d = euclidSq(vectors[i]!, centroids[c]!);
      if (d < bestDist) { bestDist = d; bestCluster = c; }
    }
    assignments[i] = bestCluster;
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// UMAP: compress high-dimensional embeddings to 2D
// ---------------------------------------------------------------------------

function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

/** Power-iteration PCA: extract one principal component. */
function principalComponent(rows: number[][], previous: number[][] = []): number[] {
  const dim = rows[0]?.length ?? 0;
  let component = normalizeVector(Array.from({ length: dim }, () => Math.random() - 0.5));
  for (let iter = 0; iter < 30; iter++) {
    const next = new Array<number>(dim).fill(0);
    for (const row of rows) {
      const score = row.reduce((sum, v, i) => sum + v * component[i]!, 0);
      for (let i = 0; i < dim; i++) next[i] += row[i]! * score;
    }
    // Orthogonalise against previous components
    for (const prev of previous) {
      const proj = next.reduce((sum, v, i) => sum + v * prev[i]!, 0);
      for (let i = 0; i < dim; i++) next[i] -= proj * prev[i]!;
    }
    component = normalizeVector(next);
  }
  return component;
}

function pcaCoordinates(centered: number[][]): { x: number; y: number }[] {
  const pc1 = principalComponent(centered);
  const pc2 = principalComponent(centered, [pc1]);
  return centered.map((row) => ({
    x: row.reduce((sum, v, i) => sum + v * pc1[i]!, 0),
    y: row.reduce((sum, v, i) => sum + v * pc2[i]!, 0),
  }));
}

function normalizeCoordinates(coords: { x: number; y: number }[], targetScale = 3): { x: number; y: number }[] {
  const xMean = coords.reduce((sum, c) => sum + c.x, 0) / Math.max(1, coords.length);
  const yMean = coords.reduce((sum, c) => sum + c.y, 0) / Math.max(1, coords.length);
  const centered = coords.map((c) => ({ x: c.x - xMean, y: c.y - yMean }));
  const maxAbs = Math.max(...centered.flatMap((c) => [Math.abs(c.x), Math.abs(c.y)]), 1);
  return centered.map((c) => ({ x: (c.x / maxAbs) * targetScale, y: (c.y / maxAbs) * targetScale }));
}

/**
 * Approximate UMAP: PCA-initialised force-directed layout that preserves
 * local neighborhoods while spreading global structure.
 *
 * Works on arbitrary high-dimensional vectors (128-dim encoder embeddings).
 */
export function approximateUmap(vectors: number[][]): { x: number; y: number }[] {
  const n = vectors.length;
  if (n === 0) return [];

  // Center vectors for PCA initialisation
  const dim = vectors[0]?.length ?? 0;
  const means = Array.from({ length: dim }, (_, j) =>
    vectors.reduce((sum, v) => sum + v[j]!, 0) / n,
  );
  const centered = vectors.map((v) => v.map((val, j) => val - means[j]!));
  const pcaInit = pcaCoordinates(centered);

  if (n < 3) return normalizeCoordinates(pcaInit, 3);

  const neighborCount = Math.min(12, n - 1);
  const coords = normalizeCoordinates(pcaInit, 2);
  const edges: { a: number; b: number; weight: number }[] = [];

  // Build k-NN graph using Euclidean distance on the full embeddings
  for (let i = 0; i < n; i++) {
    const distances: { index: number; distance: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distances.push({ index: j, distance: euclidSq(vectors[i]!, vectors[j]!) });
    }
    distances.sort((a, b) => a.distance - b.distance);
    const localScale = Math.max(distances[neighborCount - 1]?.distance ?? distances[0]?.distance ?? 1, 0.001);
    for (const neighbor of distances.slice(0, neighborCount)) {
      if (i < neighbor.index) {
        edges.push({ a: i, b: neighbor.index, weight: Math.exp(-neighbor.distance / localScale) });
      }
    }
  }

  // Force-directed optimisation: attractive forces along edges, repulsive globally
  const learningRate = 0.035;
  for (let iter = 0; iter < 90; iter++) {
    const forces = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    for (const edge of edges) {
      const a = coords[edge.a]!;
      const b = coords[edge.b]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      forces[edge.a]!.x += dx * edge.weight;
      forces[edge.a]!.y += dy * edge.weight;
      forces[edge.b]!.x -= dx * edge.weight;
      forces[edge.b]!.y -= dy * edge.weight;
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = coords[i]!;
        const b = coords[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + 0.01;
        const repulsion = 0.015 / distSq;
        forces[i]!.x -= dx * repulsion;
        forces[i]!.y -= dy * repulsion;
        forces[j]!.x += dx * repulsion;
        forces[j]!.y += dy * repulsion;
      }
    }
    const step = learningRate * (1 - iter / 100);
    for (let i = 0; i < n; i++) {
      coords[i]!.x += Math.max(-0.1, Math.min(0.1, forces[i]!.x * step));
      coords[i]!.y += Math.max(-0.1, Math.min(0.1, forces[i]!.y * step));
    }
  }

  return normalizeCoordinates(coords, 3);
}

// ---------------------------------------------------------------------------
// computeSkeletons — HDBSCAN on high-dim vectors, UMAP for visualization
// ---------------------------------------------------------------------------

/**
 * Compute archetype clusters from deck embeddings.
 *
 * Flow:
 *   1. HDBSCAN on the full high-dimensional vectors (128-dim embeddings or
 *      TF-IDF) to find density-based clusters — this avoids the information
 *      loss that comes from clustering on a lossy 2D projection.
 *   2. UMAP on the same vectors to produce 2D coordinates for the scatter plot.
 *   3. Extract archetype skeleton metadata (core cards, sideboard, etc.)
 *      from the original pool/deck data.
 *
 * @param slimPools      Slim pool data for each seat
 * @param cardMeta       Card metadata keyed by oracle_id
 * @param minClusterSize Minimum number of points for a group to be a cluster
 * @param embeddings     128-dim embeddings from the ML encoder (one per pool), or null
 *                       to fall back to TF-IDF clustering
 * @param deckBuilds     Optional built decks (mainboard/sideboard)
 * @returns { skeletons, umapCoords } — cluster data + 2D coordinates for the scatter plot
 */
export function computeSkeletons(
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  minClusterSize: number,
  embeddings: number[][] | null,
  deckBuilds?: BuiltDeck[] | null,
): { skeletons: ArchetypeSkeleton[]; umapCoords: { x: number; y: number }[] } {
  const n = slimPools.length;
  if (n === 0) return { skeletons: [], umapCoords: [] };

  // Exclude basic lands
  const oracleIds = Object.keys(cardMeta).filter((id) => {
    const t = (cardMeta[id]?.type ?? '').toLowerCase();
    return !(t.includes('basic') && t.includes('land'));
  });
  const oracleIndex = new Map(oracleIds.map((id, i) => [id, i]));
  const dim = oracleIds.length;

  // Binary card vectors (still used for skeleton card fractions / sideboard analysis)
  const hasDecks = deckBuilds && deckBuilds.length === n;
  const vecs: Uint8Array[] = slimPools.map((pool, i) => {
    const v = new Uint8Array(dim);
    const cards = hasDecks ? deckBuilds![i]!.mainboard : pool.picks.map((p) => p.oracle_id);
    for (const oracle_id of cards) {
      const idx = oracleIndex.get(oracle_id);
      if (idx !== undefined) v[idx] = 1;
    }
    return v;
  });

  // Choose the high-dimensional vectors for clustering and UMAP
  let clusterVecs: number[][];
  if (embeddings && embeddings.length === n) {
    clusterVecs = embeddings;
  } else {
    // Fallback: TF-IDF vectors
    const df = new Float32Array(dim);
    for (const v of vecs) for (let j = 0; j < dim; j++) if (v[j]) df[j]++;
    const idf = Float32Array.from({ length: dim }, (_, j) => Math.log((n + 1) / (df[j]! + 1)));
    clusterVecs = vecs.map((v) => {
      const vec = Array.from({ length: dim }, (_, j) => v[j]! * idf[j]!);
      const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
      return norm > 0 ? vec.map((x) => x / norm) : vec;
    });
  }

  // UMAP: project high-dimensional vectors to 2D for visualization
  const umapCoords = approximateUmap(clusterVecs);

  // HDBSCAN on the 2D UMAP coordinates — high-dimensional euclidean distances
  // concentrate (curse of dimensionality), making HDBSCAN see uniform density.
  // The 2D UMAP projection preserves local structure and makes clusters separable.
  // Our HDBSCAN implementation uses mutual reachability distances which prevents
  // the chaining effect that previously caused split-island artefacts in 2D.
  const umapVecs = umapCoords.map((c) => [c.x, c.y]);
  let assignments = hdbscanAssignments(umapVecs, minClusterSize);

  // If HDBSCAN collapsed to a single cluster (uniform density), fall back to
  // k-means on the 2D coordinates so the user always gets meaningful groups.
  const uniqueFromHdbscan = new Set(assignments);
  if (uniqueFromHdbscan.size <= 1 && n >= 4) {
    const k = Math.max(2, Math.min(12, Math.floor(Math.sqrt(n / 2))));
    assignments = kmeansAssignments(umapVecs, k);
  }

  // Determine the set of unique cluster IDs from the assignments
  const uniqueClusters = [...new Set(assignments)].sort((a, b) => a - b);

  const globalCardCounts = new Float32Array(dim);
  for (const v of vecs) {
    for (let j = 0; j < dim; j++) globalCardCounts[j] += v[j]!;
  }

  const skeletons: ArchetypeSkeleton[] = [];
  for (const clusterId of uniqueClusters) {
    const poolIndices = assignments.map((a, i) => (a === clusterId ? i : -1)).filter((i) => i >= 0);
    const poolCount = poolIndices.length;
    if (poolCount === 0) continue;

    // Centroid card fractions: for each card, what fraction of pools in this cluster drafted it
    const fracs = new Float32Array(dim);
    for (const pi of poolIndices) {
      const v = vecs[pi]!;
      for (let j = 0; j < dim; j++) fracs[j] += v[j]!;
    }
    for (let j = 0; j < dim; j++) fracs[j] /= poolCount;

    const allCards: (SkeletonCard & { distinctiveness: number })[] = oracleIds
      .map((oracle_id, j) => {
        const fraction = fracs[j]!;
        const globalCount = globalCardCounts[j]!;
        const idf = Math.log((n + 1) / (globalCount + 1));
        return {
          oracle_id,
          name: cardMeta[oracle_id]?.name ?? oracle_id,
          imageUrl: cardMeta[oracle_id]?.imageUrl ?? '',
          fraction,
          distinctiveness: fraction * idf,
        };
      })
      .filter((c) => c.fraction > 0)
      .sort((a, b) => b.distinctiveness - a.distinctiveness || b.fraction - a.fraction);

    const coreCards = allCards.slice(0, 12);
    const occasionalCards: SkeletonCard[] = [];
    const sideboardCards: SkeletonCard[] = hasDecks
      ? oracleIds
          .map((oracle_id) => {
            let sideboardCount = 0;
            for (const pi of poolIndices) {
              const deck = deckBuilds![pi];
              if (!deck) continue;
              const inMainboard = deck.mainboard.includes(oracle_id);
              const inSideboard = deck.sideboard.includes(oracle_id);
              if (!inMainboard && inSideboard) sideboardCount++;
            }
            return {
              oracle_id,
              name: cardMeta[oracle_id]?.name ?? oracle_id,
              imageUrl: cardMeta[oracle_id]?.imageUrl ?? '',
              fraction: sideboardCount / poolCount,
            };
          })
          .filter((card) => card.fraction >= 0.15)
          .sort((a, b) => b.fraction - a.fraction)
          .slice(0, 5)
      : [];

    // Color profile — matches server-side assessColors logic:
    // count color identity across non-land cards, include color if >10% of non-land cards have it
    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let nonLandCount = 0;
    for (const { oracle_id } of allCards) {
      const meta = cardMeta[oracle_id];
      if (!meta) continue;
      if ((meta.type ?? '').toLowerCase().includes('land')) continue;
      nonLandCount++;
      for (const c of meta.colorIdentity ?? []) {
        if (c in colorCounts) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
      }
    }
    const colorProfile = nonLandCount > 0
      ? Object.keys(colorCounts)
          .filter((c) => (colorCounts[c] ?? 0) / nonLandCount > 0.1)
          .sort()
          .join('') || 'C'
      : 'C';

    // Lock pairs
    const lockPairs: LockPair[] = [];
    const lockCandidates = allCards.slice(0, 24);
    for (let ai = 0; ai < lockCandidates.length; ai++) {
      for (let bi = ai + 1; bi < lockCandidates.length; bi++) {
        const a = lockCandidates[ai]!,
          b = lockCandidates[bi]!;
        const aIdx = oracleIndex.get(a.oracle_id)!,
          bIdx = oracleIndex.get(b.oracle_id)!;
        let both = 0;
        for (const pi of poolIndices) if (vecs[pi]![aIdx] && vecs[pi]![bIdx]) both++;
        const rate = both / poolCount;
        lockPairs.push({
          oracle_id_a: a.oracle_id,
          oracle_id_b: b.oracle_id,
          nameA: a.name,
          nameB: b.name,
          imageUrlA: a.imageUrl,
          imageUrlB: b.imageUrl,
          coOccurrenceRate: rate,
        });
      }
    }
    lockPairs.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

    skeletons.push({
      clusterId,
      colorProfile,
      poolCount,
      poolIndices,
      coreCards,
      occasionalCards,
      sideboardCards,
      lockPairs: lockPairs.slice(0, 5),
    });
  }

  return {
    skeletons: skeletons.sort((a, b) => b.poolCount - a.poolCount),
    umapCoords,
  };
}
