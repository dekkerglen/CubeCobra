/* eslint-disable camelcase, no-plusplus, no-restricted-syntax */

// ---------------------------------------------------------------------------
// Shared clustering configuration — imported by both useSimulationRun and
// useClusteringPipeline so parameters stay in sync across fresh runs and
// cached-hydration reclusters.
// ---------------------------------------------------------------------------
export const KNN_K_DIVISOR = 16;
export const LEIDEN_RES_DIVISOR = 400;
export const CLUSTER_NEG_SAMPLES = 20;

// ---------------------------------------------------------------------------
// Archetype labeling — module-level singleton fetch + pure cosine classifier
// ---------------------------------------------------------------------------
type ArchetypeData = {
  centers: { clusterId: number; center: number[] }[];
  annotations: Record<string, string>;
};

let archetypeDataPromise: Promise<ArchetypeData | null> | null = null;

export async function loadArchetypeData(): Promise<ArchetypeData | null> {
  if (!archetypeDataPromise) {
    archetypeDataPromise = (async () => {
      try {
        const resp = await fetch('/api/archetypes');
        if (!resp.ok) return null;
        return (await resp.json()) as ArchetypeData;
      } catch {
        return null;
      }
    })();
  }
  return archetypeDataPromise;
}

export function assignArchetypeLabels(
  poolEmbeddings: number[][],
  archetypeData: ArchetypeData,
): Map<number, string> {
  const labels = new Map<number, string>();
  for (let pi = 0; pi < poolEmbeddings.length; pi++) {
    const emb = poolEmbeddings[pi]!;
    const embNorm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0)) || 1;
    let bestSim = -Infinity;
    let bestClusterId = -1;
    for (const { clusterId, center } of archetypeData.centers) {
      let dot = 0;
      const cNorm = Math.sqrt(center.reduce((s, v) => s + v * v, 0)) || 1;
      for (let d = 0; d < emb.length; d++) dot += emb[d]! * (center[d] ?? 0);
      const sim = dot / (embNorm * cNorm);
      if (sim > bestSim) {
        bestSim = sim;
        bestClusterId = clusterId;
      }
    }
    const label = archetypeData.annotations[String(bestClusterId)];
    if (label) labels.set(pi, label);
  }
  return labels;
}

import {
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  LockPair,
  RankedCards,
  SkeletonCard,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

// ---------------------------------------------------------------------------
// Seeded PRNG (xorshift32) for deterministic clustering
// ---------------------------------------------------------------------------

function createRng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function deriveClusterSeed(slimPools: SlimPool[]): number {
  let h = slimPools.length;
  for (let i = 0; i < Math.min(slimPools.length, 20); i++) {
    const pool = slimPools[i]!;
    for (let j = 0; j < Math.min(pool.picks.length, 5); j++) {
      const id = pool.picks[j]!.oracle_id;
      for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) | 0;
    }
  }
  return h;
}

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

export function cosineDist(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? 1 - dot / denom : 1;
}

// ---------------------------------------------------------------------------
// k-means fallback for uniform-density data
// ---------------------------------------------------------------------------

/**
 * Simple k-means++ seeded k-means. Used as a fallback when HDBSCAN sees
 * uniform density and collapses everything into one cluster.
 */
function kmeansAssignments(vectors: number[][], k: number, maxIter = 30, rng: () => number = Math.random): number[] {
  const n = vectors.length;
  const dim = vectors[0]?.length ?? 0;
  if (n === 0 || k <= 0) return [];
  if (k >= n) return vectors.map((_, i) => i);

  // k-means++ initialisation
  const centroids: number[][] = [];
  const firstIdx = Math.floor(rng() * n);
  centroids.push([...vectors[firstIdx]!]);

  for (let c = 1; c < k; c++) {
    const dists = vectors.map((v) => {
      let minD = Infinity;
      for (const cent of centroids) minD = Math.min(minD, euclidSq(v, cent));
      return minD;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let r = rng() * total;
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
/**
 * Shared HDBSCAN internals: takes sorted MST edges and produces cluster assignments.
 * Used by both the dense (vector-based) and sparse (graph-based) HDBSCAN paths.
 */
function hdbscanFromMST(
  mstEdges: { i: number; j: number; dist: number }[],
  n: number,
  minClusterSize: number,
  vectors: number[][], // for noise → nearest centroid assignment
): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];

  // Build single-linkage dendrogram from sorted MST edges
  const dendroLeft: number[] = new Array(n).fill(-1);
  const dendroRight: number[] = new Array(n).fill(-1);
  const dendroDist: number[] = new Array(n).fill(0);
  const dendroSize: number[] = new Array(n).fill(1);

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

  // Build condensed tree + accumulate stability
  const condensed: CondensedCluster[] = [];
  condensed.push({
    id: 0, birthLambda: 0, childIds: [], stability: 0,
    selected: false, allPointIndices: [],
  });

  function walk(startNodeIdx: number, startClusterId: number): void {
    const workStack: [number, number][] = [[startNodeIdx, startClusterId]];

    while (workStack.length > 0) {
      const [initialNodeIdx, clusterId] = workStack.pop()!;
      let nodeIdx = initialNodeIdx;
      const cluster = condensed[clusterId]!;

      while (true) {
        if (nodeIdx < n) {
          cluster.allPointIndices.push(nodeIdx);
          break;
        }

        const dist = dendroDist[nodeIdx]!;
        // Cap lambda to avoid infinity/overflow when two points are nearly identical.
        const lambda = dist > 1e-6 ? 1 / dist : 1e6;
        const leftIdx = dendroLeft[nodeIdx]!;
        const rightIdx = dendroRight[nodeIdx]!;
        const leftSize = dendroSize[leftIdx]!;
        const rightSize = dendroSize[rightIdx]!;
        const leftBig = leftSize >= minClusterSize;
        const rightBig = rightSize >= minClusterSize;

        if (leftBig && rightBig) {
          cluster.stability += (lambda - cluster.birthLambda) * (leftSize + rightSize);
          const leftCId = condensed.length;
          condensed.push({ id: leftCId, birthLambda: lambda, childIds: [], stability: 0, selected: false, allPointIndices: [] });
          const rightCId = condensed.length;
          condensed.push({ id: rightCId, birthLambda: lambda, childIds: [], stability: 0, selected: false, allPointIndices: [] });
          cluster.childIds = [leftCId, rightCId];
          workStack.push([leftIdx, leftCId]);
          workStack.push([rightIdx, rightCId]);
          break;
        } else if (leftBig) {
          cluster.stability += (lambda - cluster.birthLambda) * rightSize;
          cluster.allPointIndices.push(...collectPoints(rightIdx));
          nodeIdx = leftIdx;
        } else if (rightBig) {
          cluster.stability += (lambda - cluster.birthLambda) * leftSize;
          cluster.allPointIndices.push(...collectPoints(leftIdx));
          nodeIdx = rightIdx;
        } else {
          cluster.stability += (lambda - cluster.birthLambda) * (leftSize + rightSize);
          cluster.allPointIndices.push(...collectPoints(nodeIdx));
          break;
        }
      }
    }

    for (let i = condensed.length - 1; i >= 0; i--) {
      const c = condensed[i]!;
      for (const childId of c.childIds) {
        c.allPointIndices.push(...condensed[childId]!.allPointIndices);
      }
    }
  }

  walk(treeRoot, 0);

  // Bottom-up stability selection
  function selectClusters(cId: number): number {
    const c = condensed[cId]!;
    if (c.childIds.length === 0) { c.selected = true; return c.stability; }
    const childStabilitySum = c.childIds.reduce((sum, childId) => sum + selectClusters(childId), 0);
    if (childStabilitySum > c.stability) { c.selected = false; return childStabilitySum; }
    c.selected = true;
    function deselectSubtree(id: number): void {
      const node = condensed[id]!; node.selected = false;
      for (const childId of node.childIds) deselectSubtree(childId);
    }
    for (const childId of c.childIds) deselectSubtree(childId);
    return c.stability;
  }

  selectClusters(0);

  // Assign points to selected clusters; noise to nearest centroid
  const dim = vectors[0]?.length ?? 0;
  const assignments = new Array<number>(n).fill(-1);
  const selectedClusters: CondensedCluster[] = condensed.filter((c) => c.selected);
  if (selectedClusters.length === 0) return new Array<number>(n).fill(0);

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

/**
 * Dense HDBSCAN: compute core distances and MST from all pairwise distances,
 * then delegate to hdbscanFromMST for dendrogram + cluster extraction.
 */
export function hdbscanAssignments(
  vectors: number[][],
  minClusterSize: number,
  minPtsOverride?: number,
): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const minPts = Math.min(minPtsOverride ?? 3, n - 1);

  // Core distances
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

  function mreach(i: number, j: number): number {
    return Math.max(coreDist[i]!, coreDist[j]!, euclidean(vectors[i]!, vectors[j]!));
  }

  // MST via Prim's
  interface MSTEdge { i: number; j: number; dist: number }
  const mstEdges: MSTEdge[] = [];
  const inMST = new Uint8Array(n);
  const minEdgeDist = new Float64Array(n).fill(Infinity);
  const minEdgeFrom = new Int32Array(n).fill(-1);

  inMST[0] = 1;
  for (let j = 1; j < n; j++) { minEdgeDist[j] = mreach(0, j); minEdgeFrom[j] = 0; }

  for (let step = 1; step < n; step++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!inMST[j] && minEdgeDist[j]! < bestDist) { bestDist = minEdgeDist[j]!; bestIdx = j; }
    }
    if (bestIdx < 0) break;
    inMST[bestIdx] = 1;
    mstEdges.push({ i: minEdgeFrom[bestIdx]!, j: bestIdx, dist: bestDist });
    for (let j = 0; j < n; j++) {
      if (inMST[j]) continue;
      const d = mreach(bestIdx, j);
      if (d < minEdgeDist[j]!) { minEdgeDist[j] = d; minEdgeFrom[j] = bestIdx; }
    }
  }

  mstEdges.sort((a, b) => a.dist - b.dist);
  return hdbscanFromMST(mstEdges, n, minClusterSize, vectors);
}

/**
 * Graph-based HDBSCAN: derive core distances and MST from the k-NN graph
 * instead of computing all pairwise distances. Much faster for large n.
 */
function hdbscanFromKnnGraph(
  graph: KNNGraph,
  n: number,
  minClusterSize: number,
  minPts: number,
  vectors: number[][], // for noise → nearest centroid
): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];

  const effectiveMinPts = Math.min(minPts, graph.neighbors[0]?.length ?? 1);

  // Core distances from k-NN neighbors
  const coreDist = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kNeighbors = graph.neighbors[i]!;
    coreDist[i] = kNeighbors[Math.min(effectiveMinPts - 1, kNeighbors.length - 1)]!.dist;
  }

  // Collect all k-NN edges with mutual reachability distances (deduplicated i < j)
  const mreachEdges: { i: number; j: number; dist: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (const nb of graph.neighbors[i]!) {
      const j = nb.index;
      if (i < j) {
        mreachEdges.push({ i, j, dist: Math.max(coreDist[i]!, coreDist[j]!, nb.dist) });
      }
    }
  }

  // Kruskal's MST on sparse edges
  mreachEdges.sort((a, b) => a.dist - b.dist);

  const ufParent = Int32Array.from({ length: n }, (_, i) => i);
  const ufRank = new Uint8Array(n);
  function find(x: number): number {
    let r = x;
    while (ufParent[r] !== r) r = ufParent[r]!;
    while (ufParent[x] !== r) { const next = ufParent[x]!; ufParent[x] = r; x = next; }
    return r;
  }

  const mstEdges: { i: number; j: number; dist: number }[] = [];
  for (const edge of mreachEdges) {
    const ri = find(edge.i);
    const rj = find(edge.j);
    if (ri === rj) continue;
    mstEdges.push(edge);
    if (ufRank[ri]! < ufRank[rj]!) { ufParent[ri] = rj; }
    else if (ufRank[ri]! > ufRank[rj]!) { ufParent[rj] = ri; }
    else { ufParent[rj] = ri; ufRank[ri]!++; }
    if (mstEdges.length === n - 1) break;
  }

  // If the k-NN graph is disconnected, some components won't be linked.
  // Connect remaining components with large-distance dummy edges.
  if (mstEdges.length < n - 1) {
    const maxDist = mstEdges.length > 0 ? mstEdges[mstEdges.length - 1]!.dist * 2 : 1;
    for (let i = 1; i < n; i++) {
      const ri = find(0);
      const rj = find(i);
      if (ri !== rj) {
        mstEdges.push({ i: 0, j: i, dist: maxDist });
        if (ufRank[ri]! < ufRank[rj]!) { ufParent[ri] = rj; }
        else if (ufRank[ri]! > ufRank[rj]!) { ufParent[rj] = ri; }
        else { ufParent[rj] = ri; ufRank[ri]!++; }
      }
    }
    mstEdges.sort((a, b) => a.dist - b.dist);
  }

  return hdbscanFromMST(mstEdges, n, minClusterSize, vectors);
}

// ---------------------------------------------------------------------------
// Leiden community detection (Louvain-style modularity optimization)
// ---------------------------------------------------------------------------

export function leidenAssignments(
  graph: KNNGraph,
  n: number,
  resolution: number = 1.0,
  rng: () => number = Math.random,
): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];

  // Build symmetric adjacency from k-NN neighbors (binary weights)
  const adjList: number[][] = Array.from({ length: n }, () => []);
  const seen = new Set<number>();

  const seenStr = new Set<string>();
  for (let i = 0; i < n; i++) {
    for (const nb of graph.neighbors[i]!) {
      const j = nb.index;
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      if (!seenStr.has(key)) {
        seenStr.add(key);
        adjList[i]!.push(j);
        adjList[j]!.push(i);
      }
    }
  }

  const deg = new Float64Array(n);
  for (let i = 0; i < n; i++) deg[i] = adjList[i]!.length;
  const totalEdges = seenStr.size;

  if (totalEdges === 0) return Array.from({ length: n }, (_, i) => i);

  const m2 = 2 * totalEdges;

  // Each node starts in its own community
  const comm = new Int32Array(n);
  for (let i = 0; i < n; i++) comm[i] = i;

  // Sum of degrees per community
  const commDeg = new Float64Array(n);
  for (let i = 0; i < n; i++) commDeg[i] = deg[i]!;

  for (let iter = 0; iter < 50; iter++) {
    let moved = false;

    // Shuffle node visit order
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }

    for (const i of order) {
      const ci = comm[i]!;
      const ki = deg[i]!;

      // Count edges from i to each neighboring community
      const neighborComms = new Map<number, number>();
      for (const j of adjList[i]!) {
        const cj = comm[j]!;
        neighborComms.set(cj, (neighborComms.get(cj) ?? 0) + 1);
      }

      const ki_own = neighborComms.get(ci) ?? 0;

      let bestComm = ci;
      let bestDelta = 0;

      for (const [cj, ki_cj] of neighborComms) {
        if (cj === ci) continue;
        // ΔQ = (ki_cj - ki_own)/m - γ·ki·(Σ_tot_cj - Σ_tot_ci + ki)/(2m²)
        const delta = (ki_cj - ki_own) / totalEdges
          - resolution * ki * (commDeg[cj]! - commDeg[ci]! + ki) / (m2 * totalEdges);
        if (delta > bestDelta) {
          bestDelta = delta;
          bestComm = cj;
        }
      }

      if (bestComm !== ci) {
        comm[i] = bestComm;
        commDeg[ci] -= ki;
        commDeg[bestComm] += ki;
        moved = true;
      }
    }

    if (!moved) break;
  }

  // Renumber to contiguous 0-based IDs
  const remap = new Map<number, number>();
  let nextId = 0;
  return Array.from(comm, (c) => {
    if (!remap.has(c)) remap.set(c, nextId++);
    return remap.get(c)!;
  });
}

// ---------------------------------------------------------------------------
// NMF (Non-negative Matrix Factorization) topic modeling
// ---------------------------------------------------------------------------

export function nmfAssignments(
  cardMatrix: Uint8Array[],
  numTopics: number,
  maxIter: number = 100,
  rng: () => number = Math.random,
): number[] {
  const n = cardMatrix.length;
  const d = cardMatrix[0]?.length ?? 0;
  if (n === 0 || d === 0 || numTopics <= 0) return new Array(n).fill(0);

  const k = Math.min(numTopics, n);
  const eps = 1e-10;

  // Pre-compute non-zero column indices per row for sparse multiplication
  const nnzByRow: number[][] = cardMatrix.map((row) => {
    const nz: number[] = [];
    for (let j = 0; j < d; j++) if (row[j]) nz.push(j);
    return nz;
  });

  // Initialize W (n × k) and H (k × d) with small random values
  const W: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: k }, () => rng() * 0.5 + 0.01),
  );
  const H: number[][] = Array.from({ length: k }, () =>
    Array.from({ length: d }, () => rng() * 0.5 + 0.01),
  );

  for (let iter = 0; iter < maxIter; iter++) {
    // Update H: H *= (W^T V) ./ (W^T W H + eps)
    // Exploit sparsity: W^T V[a][j] = Σ_{i: V[i][j]=1} W[i][a]
    const WtV: number[][] = Array.from({ length: k }, () => new Array(d).fill(0));
    const WtW: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));

    for (let i = 0; i < n; i++) {
      for (let a = 0; a < k; a++) {
        const wia = W[i]![a]!;
        for (const j of nnzByRow[i]!) WtV[a]![j] += wia;
        for (let b = 0; b < k; b++) WtW[a]![b] += wia * W[i]![b]!;
      }
    }

    for (let a = 0; a < k; a++) {
      for (let j = 0; j < d; j++) {
        let WtWH = 0;
        for (let b = 0; b < k; b++) WtWH += WtW[a]![b]! * H[b]![j]!;
        H[a]![j] = H[a]![j]! * WtV[a]![j]! / (WtWH + eps);
      }
    }

    // Update W: W *= (V H^T) ./ (W H H^T + eps)
    const HHt: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        let s = 0;
        for (let j = 0; j < d; j++) s += H[a]![j]! * H[b]![j]!;
        HHt[a]![b] = s;
      }
    }

    for (let i = 0; i < n; i++) {
      // VHt[a] = Σ_{j ∈ nnz(i)} H[a][j]   (sparse: V is binary)
      const VHt = new Array<number>(k).fill(0);
      for (let a = 0; a < k; a++) {
        for (const j of nnzByRow[i]!) VHt[a] += H[a]![j]!;
      }

      for (let a = 0; a < k; a++) {
        let WHHt = 0;
        for (let b = 0; b < k; b++) WHHt += W[i]![b]! * HHt[b]![a]!;
        W[i]![a] = W[i]![a]! * VHt[a]! / (WHHt + eps);
      }
    }
  }

  // Assign each deck to its highest-weight topic
  return W.map((row) => {
    let bestK = 0;
    let bestW = -1;
    for (let a = 0; a < k; a++) {
      if (row[a]! > bestW) { bestW = row[a]!; bestK = a; }
    }
    return bestK;
  });
}

/**
 * Run NMF on a subset of decks and return the top cards per topic.
 * Designed for real-time topic decomposition within a single cluster.
 *
 * @param poolIndices  Indices into slimPools for this cluster
 * @param slimPools    All slim pools
 * @param cardMeta     Card metadata
 * @param numTopics    Number of topics to extract
 * @param deckBuilds   Optional deck builds (uses mainboard if available)
 * @returns Array of topics, each with a label and top cards sorted by weight
 */
export function nmfDecompose(
  poolIndices: number[],
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  numTopics: number,
  deckBuilds?: BuiltDeck[] | null,
): { topicIndex: number; cards: { oracle_id: string; name: string; imageUrl: string; weight: number }[] }[] {
  const hasDecks = deckBuilds && deckBuilds.length === slimPools.length;

  // Build oracle ID list (exclude basic lands)
  const oracleIds = Object.keys(cardMeta).filter((id) => {
    const t = (cardMeta[id]?.type ?? '').toLowerCase();
    return !(t.includes('basic') && t.includes('land'));
  });
  const oracleIndex = new Map(oracleIds.map((id, i) => [id, i]));
  const dim = oracleIds.length;

  // Build binary card matrix for just this cluster's pools
  const matrix: Uint8Array[] = poolIndices.map((pi) => {
    const v = new Uint8Array(dim);
    const pool = slimPools[pi]!;
    const cards = hasDecks ? deckBuilds![pi]!.mainboard : pool.picks.map((p) => p.oracle_id);
    for (const oracle_id of cards) {
      const idx = oracleIndex.get(oracle_id);
      if (idx !== undefined) v[idx] = 1;
    }
    return v;
  });

  const n = matrix.length;
  const k = Math.min(numTopics, n);
  if (n === 0 || k <= 0) return [];

  const eps = 1e-10;
  const rng = createRng(poolIndices.length * 31 + poolIndices[0]!);

  const nnzByRow: number[][] = matrix.map((row) => {
    const nz: number[] = [];
    for (let j = 0; j < dim; j++) if (row[j]) nz.push(j);
    return nz;
  });

  const W: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: k }, () => rng() * 0.5 + 0.01),
  );
  const H: number[][] = Array.from({ length: k }, () =>
    Array.from({ length: dim }, () => rng() * 0.5 + 0.01),
  );

  for (let iter = 0; iter < 100; iter++) {
    const WtV: number[][] = Array.from({ length: k }, () => new Array(dim).fill(0));
    const WtW: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < k; a++) {
        const wia = W[i]![a]!;
        for (const j of nnzByRow[i]!) WtV[a]![j] += wia;
        for (let b = 0; b < k; b++) WtW[a]![b] += wia * W[i]![b]!;
      }
    }
    for (let a = 0; a < k; a++) {
      for (let j = 0; j < dim; j++) {
        let WtWH = 0;
        for (let b = 0; b < k; b++) WtWH += WtW[a]![b]! * H[b]![j]!;
        H[a]![j] = H[a]![j]! * WtV[a]![j]! / (WtWH + eps);
      }
    }

    const HHt: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        let s = 0;
        for (let j = 0; j < dim; j++) s += H[a]![j]! * H[b]![j]!;
        HHt[a]![b] = s;
      }
    }
    for (let i = 0; i < n; i++) {
      const VHt = new Array<number>(k).fill(0);
      for (let a = 0; a < k; a++) {
        for (const j of nnzByRow[i]!) VHt[a] += H[a]![j]!;
      }
      for (let a = 0; a < k; a++) {
        let WHHt = 0;
        for (let b = 0; b < k; b++) WHHt += W[i]![b]! * HHt[b]![a]!;
        W[i]![a] = W[i]![a]! * VHt[a]! / (WHHt + eps);
      }
    }
  }

  // Extract top cards per topic from H matrix
  return Array.from({ length: k }, (_, topicIdx) => {
    const topicRow = H[topicIdx]!;
    const cardWeights = oracleIds
      .map((oracle_id, j) => ({ oracle_id, weight: topicRow[j]! }))
      .filter((c) => c.weight > 0.01)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map((c) => ({
        oracle_id: c.oracle_id,
        name: cardMeta[c.oracle_id]?.name ?? c.oracle_id,
        imageUrl: cardMeta[c.oracle_id]?.imageUrl ?? '',
        weight: c.weight,
      }));
    return { topicIndex: topicIdx, cards: cardWeights };
  });
}

/**
 * Find co-occurrence pockets: groups of cards that frequently appear together
 * in this cluster's decks. Uses pairwise co-occurrence rates as feature vectors
 * for k-means clustering — cards that travel together have similar profiles.
 *
 * @param poolIndices  Indices of pools in this cluster
 * @param slimPools    All slim pools
 * @param cardMeta     Card metadata for names/images
 * @param numPockets   Number of card groups (k)
 * @param deckBuilds   Optional deck builds (uses mainboard if available)
 */
export function findCooccurrencePockets(
  poolIndices: number[],
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  numPockets: number,
  deckBuilds?: BuiltDeck[] | null,
): { pocketIndex: number; cards: { oracle_id: string; name: string; imageUrl: string; frequency: number }[] }[] {
  if (poolIndices.length === 0 || numPockets < 1) return [];

  const hasDecks = deckBuilds && deckBuilds.length === slimPools.length;
  const nDecks = poolIndices.length;

  // Build card presence sets per deck + collect unique cards
  const deckCardSets: Set<string>[] = [];
  const cardCounts = new Map<string, number>();
  for (const pi of poolIndices) {
    const pool = slimPools[pi]!;
    const cards = hasDecks ? deckBuilds![pi]!.mainboard : pool.picks.map((p) => p.oracle_id);
    const cardSet = new Set<string>();
    for (const id of cards) {
      const t = (cardMeta[id]?.type ?? '').toLowerCase();
      if (!(t.includes('basic') && t.includes('land'))) {
        cardSet.add(id);
        cardCounts.set(id, (cardCounts.get(id) ?? 0) + 1);
      }
    }
    deckCardSets.push(cardSet);
  }

  // Filter to cards appearing in at least 15% of cluster decks
  const oracleIds = [...cardCounts.entries()]
    .filter(([_, count]) => count / nDecks >= 0.15)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const numCards = oracleIds.length;
  if (numCards === 0) return [];
  const cardIdx = new Map(oracleIds.map((id, i) => [id, i]));

  // Build co-occurrence matrix: cooc[i][j] = fraction of decks containing both card i and card j
  const cooc: number[][] = Array.from({ length: numCards }, () => new Array(numCards).fill(0));
  for (const deckSet of deckCardSets) {
    const present: number[] = [];
    for (const id of deckSet) {
      const idx = cardIdx.get(id);
      if (idx !== undefined) present.push(idx);
    }
    for (let a = 0; a < present.length; a++) {
      for (let b = a; b < present.length; b++) {
        cooc[present[a]!]![present[b]!]++;
        if (a !== b) cooc[present[b]!]![present[a]!]++;
      }
    }
  }
  // Normalize to fractions
  for (let i = 0; i < numCards; i++) {
    for (let j = 0; j < numCards; j++) {
      cooc[i]![j] /= nDecks;
    }
  }

  // K-means on co-occurrence profiles
  const k = Math.min(numPockets, numCards);
  const rng = createRng(poolIndices.length * 43 + numCards);
  const assignments = kmeansAssignments(cooc, k, 30, rng);

  // Group cards by assignment, sorted by frequency in cluster
  const groups = new Map<number, string[]>();
  for (let i = 0; i < numCards; i++) {
    const c = assignments[i]!;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(oracleIds[i]!);
  }

  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([_, cards], idx) => ({
      pocketIndex: idx,
      cards: cards
        .sort((a, b) => (cardCounts.get(b) ?? 0) - (cardCounts.get(a) ?? 0))
        .slice(0, 10)
        .map((id) => ({
          oracle_id: id,
          name: cardMeta[id]?.name ?? id,
          imageUrl: cardMeta[id]?.imageUrl ?? '',
          frequency: (cardCounts.get(id) ?? 0) / nDecks,
        })),
    }));
}

// ---------------------------------------------------------------------------
// UMAP: compress high-dimensional embeddings to 2D
// ---------------------------------------------------------------------------

function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

/** Power-iteration PCA: extract one principal component. */
function principalComponent(rows: number[][], previous: number[][] = [], rng: () => number = Math.random): number[] {
  const dim = rows[0]?.length ?? 0;
  let component = normalizeVector(Array.from({ length: dim }, () => rng() - 0.5));
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

// ---------------------------------------------------------------------------
// k-NN graph (shared between UMAP runs)
// ---------------------------------------------------------------------------

interface KNNEdge { a: number; b: number; weight: number }

interface KNNGraph {
  edges: KNNEdge[];
  neighbors: { index: number; dist: number }[][]; // per-point k nearest neighbors with raw euclidean distances
}

export function buildKnnGraph(vectors: number[][], neighborCount: number, metric: 'euclidean' | 'cosine' = 'euclidean'): KNNGraph {
  const n = vectors.length;
  const edges: KNNEdge[] = [];
  const neighbors: { index: number; dist: number }[][] = [];
  const useCosine = metric === 'cosine';
  for (let i = 0; i < n; i++) {
    const distances: { index: number; distance: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distances.push({ index: j, distance: useCosine ? cosineDist(vectors[i]!, vectors[j]!) : euclidSq(vectors[i]!, vectors[j]!) });
    }
    distances.sort((a, b) => a.distance - b.distance);
    const kNeighbors = distances.slice(0, neighborCount);
    neighbors.push(kNeighbors.map((d) => ({ index: d.index, dist: useCosine ? d.distance : Math.sqrt(d.distance) })));
    const localScale = Math.max(kNeighbors[kNeighbors.length - 1]?.distance ?? kNeighbors[0]?.distance ?? 1, 0.001);
    for (const neighbor of kNeighbors) {
      if (i < neighbor.index) {
        edges.push({ a: i, b: neighbor.index, weight: Math.exp(-neighbor.distance / localScale) });
      }
    }
  }
  return { edges, neighbors };
}

// ---------------------------------------------------------------------------
// Generalized UMAP: project to arbitrary target dimensions
// ---------------------------------------------------------------------------

/** PCA initialization to `targetDim` dimensions. */
function pcaInitNd(centered: number[][], targetDim: number, rng: () => number = Math.random): number[][] {
  const pcs: number[][] = [];
  for (let i = 0; i < targetDim; i++) {
    pcs.push(principalComponent(centered, pcs, rng));
  }
  return centered.map((row) =>
    pcs.map((pc) => row.reduce((sum, v, j) => sum + v * pc[j]!, 0)),
  );
}

/** Normalize Nd coordinates: center and scale to ±targetScale. */
function normalizeNd(coords: number[][], targetScale: number): number[][] {
  const n = coords.length;
  if (n === 0) return coords;
  const d = coords[0]!.length;
  const means = Array.from({ length: d }, (_, j) =>
    coords.reduce((sum, c) => sum + c[j]!, 0) / n,
  );
  const centered = coords.map((c) => c.map((v, j) => v - means[j]!));
  let maxAbs = 1;
  for (const c of centered) for (const v of c) maxAbs = Math.max(maxAbs, Math.abs(v));
  return centered.map((c) => c.map((v) => (v / maxAbs) * targetScale));
}

/**
 * UMAP projection to `targetDim` dimensions using negative sampling.
 * PCA-initialized, force-directed layout preserving local neighborhoods.
 *
 * @param edges       Pre-built k-NN graph edges
 * @param n           Number of points
 * @param targetDim   Output dimensionality (2 for viz, higher for clustering)
 * @param vectors     Original high-dim vectors (for PCA initialization)
 * @param negSamples  Negative samples per edge endpoint (default 5)
 * @param iterations  Force-directed iterations (default 90)
 */
function umapProject(
  edges: KNNEdge[],
  n: number,
  targetDim: number,
  vectors: number[][],
  negSamples: number = 5,
  iterations: number = 90,
  rng: () => number = Math.random,
): number[][] {
  if (n === 0) return [];

  // PCA initialization
  const dim = vectors[0]?.length ?? 0;
  const means = Array.from({ length: dim }, (_, j) =>
    vectors.reduce((sum, v) => sum + v[j]!, 0) / n,
  );
  const centered = vectors.map((v) => v.map((val, j) => val - means[j]!));
  const pcaInit = pcaInitNd(centered, Math.min(targetDim, dim, n), rng);
  const coords = normalizeNd(pcaInit, 2);

  if (n < 3) return normalizeNd(coords, 3);

  // Force-directed optimization with negative sampling
  const learningRate = 0.035;
  for (let iter = 0; iter < iterations; iter++) {
    const forces: number[][] = Array.from({ length: n }, () => new Array(targetDim).fill(0));

    // Attractive forces along k-NN edges
    for (const edge of edges) {
      const a = coords[edge.a]!;
      const b = coords[edge.b]!;
      for (let d = 0; d < targetDim; d++) {
        const delta = b[d]! - a[d]!;
        forces[edge.a]![d] += delta * edge.weight;
        forces[edge.b]![d] -= delta * edge.weight;
      }

      // Negative sampling: for each edge endpoint, repulse against random points
      for (let s = 0; s < negSamples; s++) {
        const negA = Math.floor(rng() * n);
        if (negA !== edge.a) {
          let distSq = 0;
          for (let d = 0; d < targetDim; d++) distSq += (coords[edge.a]![d]! - coords[negA]![d]!) ** 2;
          distSq += 0.01;
          const repulsion = 0.015 / distSq;
          for (let d = 0; d < targetDim; d++) {
            const delta = coords[negA]![d]! - coords[edge.a]![d]!;
            forces[edge.a]![d] -= delta * repulsion;
          }
        }
        const negB = Math.floor(rng() * n);
        if (negB !== edge.b) {
          let distSq = 0;
          for (let d = 0; d < targetDim; d++) distSq += (coords[edge.b]![d]! - coords[negB]![d]!) ** 2;
          distSq += 0.01;
          const repulsion = 0.015 / distSq;
          for (let d = 0; d < targetDim; d++) {
            const delta = coords[negB]![d]! - coords[edge.b]![d]!;
            forces[edge.b]![d] -= delta * repulsion;
          }
        }
      }
    }

    const step = learningRate * (1 - iter / (iterations + 10));
    const clamp = 0.1;
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < targetDim; d++) {
        coords[i]![d] += Math.max(-clamp, Math.min(clamp, forces[i]![d]! * step));
      }
    }
  }

  return normalizeNd(coords, 3);
}

/**
 * Approximate UMAP to 2D: convenience wrapper around umapProject.
 * Builds its own k-NN graph if not provided.
 */
export function approximateUmap(vectors: number[][], prebuiltEdges?: KNNEdge[], negSamples: number = 20, rng: () => number = Math.random): { x: number; y: number }[] {
  const n = vectors.length;
  if (n === 0) return [];
  const edges = prebuiltEdges ?? buildKnnGraph(vectors, Math.min(50, n - 1)).edges;
  const coords = umapProject(edges, n, 2, vectors, negSamples, 90, rng);
  return coords.map((c) => ({ x: c[0]!, y: c[1]! }));
}

// ---------------------------------------------------------------------------
// computeSkeletons — Leiden community detection + per-cluster card scoring.
// Per-cluster scoring is factored out (scoreClusterSkeleton) so that callers
// who already have valid cluster assignments — e.g. hydrating a cached run —
// can rescore with the latest algorithms without redoing k-NN/UMAP/Leiden.
// ---------------------------------------------------------------------------

interface SkeletonScoringContext {
  oracleIds: string[];
  oracleIndex: Map<string, number>;
  cardMeta: Record<string, CardMeta>;
  vecs: Uint8Array[];
  sourceIndicesByPool: Uint16Array[];
  clusterFracsMap: Map<number, Float32Array>;
  cardEmbeddings: (Float32Array | null)[] | null;
  embeddings: number[][] | null;
  embDim: number;
  deckBuilds: BuiltDeck[] | null | undefined;
  hasDecks: boolean;
}

function buildScoringContext(
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  embeddings: number[][] | null,
  deckBuilds: BuiltDeck[] | null | undefined,
  clusters: { clusterId: number; poolIndices: number[] }[],
): SkeletonScoringContext {
  const n = slimPools.length;

  // Exclude basic lands
  const oracleIds = Object.keys(cardMeta).filter((id) => {
    const t = (cardMeta[id]?.type ?? '').toLowerCase();
    return !(t.includes('basic') && t.includes('land'));
  });
  const oracleIndex = new Map(oracleIds.map((id, i) => [id, i]));
  const dim = oracleIds.length;

  const hasDecks = !!(deckBuilds && deckBuilds.length === n);
  const sourceIndicesByPool: Uint16Array[] = new Array(n);
  const vecs: Uint8Array[] = slimPools.map((pool, i) => {
    const v = new Uint8Array(dim);
    const cards = hasDecks ? deckBuilds![i]!.mainboard : pool.picks.map((p) => p.oracle_id);
    const indices: number[] = [];
    for (const oracle_id of cards) {
      const idx = oracleIndex.get(oracle_id);
      if (idx !== undefined && !v[idx]) {
        v[idx] = 1;
        indices.push(idx);
      }
    }
    sourceIndicesByPool[i] = Uint16Array.from(indices);
    return v;
  });

  const clusterFracsMap = new Map<number, Float32Array>();
  for (const { clusterId, poolIndices } of clusters) {
    const f = new Float32Array(dim);
    for (const pi of poolIndices) {
      const indices = sourceIndicesByPool[pi];
      if (!indices) continue;
      for (let k = 0; k < indices.length; k++) {
        f[indices[k]!] += 1;
      }
    }
    const cnt = poolIndices.length;
    if (cnt > 0) for (let j = 0; j < dim; j++) f[j] /= cnt;
    clusterFracsMap.set(clusterId, f);
  }

  const hasEmbeddings = embeddings !== null && embeddings.length === n && (embeddings[0]?.length ?? 0) > 0;
  const embDim = hasEmbeddings ? embeddings![0]!.length : 0;
  const cardEmbeddings: (Float32Array | null)[] | null = hasEmbeddings ? new Array(dim).fill(null) : null;
  if (hasEmbeddings && cardEmbeddings) {
    const cardCounts = new Uint16Array(dim);
    for (let i = 0; i < n; i++) {
      const e = embeddings![i]!;
      const indices = sourceIndicesByPool[i]!;
      for (let j = 0; j < indices.length; j++) {
        const idx = indices[j]!;
        let sum = cardEmbeddings[idx];
        if (!sum) {
          sum = new Float32Array(embDim);
          cardEmbeddings[idx] = sum;
        }
        for (let k = 0; k < embDim; k++) sum[k] += e[k]!;
        cardCounts[idx] += 1;
      }
    }
    for (let j = 0; j < dim; j++) {
      const sum = cardEmbeddings[j];
      const count = cardCounts[j]!;
      if (!sum || count === 0) continue;
      for (let k = 0; k < embDim; k++) sum[k] /= count;
      let norm = 0;
      for (let k = 0; k < embDim; k++) norm += sum[k]! * sum[k]!;
      norm = Math.sqrt(norm);
      if (norm > 0) for (let k = 0; k < embDim; k++) sum[k] /= norm;
    }
  }

  return {
    oracleIds,
    oracleIndex,
    cardMeta,
    vecs,
    sourceIndicesByPool,
    clusterFracsMap,
    cardEmbeddings,
    embeddings,
    embDim,
    deckBuilds,
    hasDecks,
  };
}

function scoreClusterSkeleton(
  ctx: SkeletonScoringContext,
  clusterId: number,
  poolIndices: number[],
): ArchetypeSkeleton | null {
  const poolCount = poolIndices.length;
  if (poolCount === 0) return null;

  const { oracleIds, oracleIndex, cardMeta, vecs, clusterFracsMap, deckBuilds, hasDecks } = ctx;
  const fracs = clusterFracsMap.get(clusterId);
  if (!fracs) return null;

  // Staples: cards drafted most often in this cluster, sorted by raw fraction.
  // No IDF: distinctiveness/cluster-uniqueness is the Distinct tab's job.
  const allCards: SkeletonCard[] = oracleIds
    .map((oracle_id, j) => ({
      oracle_id,
      name: cardMeta[oracle_id]?.name ?? oracle_id,
      imageUrl: cardMeta[oracle_id]?.imageUrl ?? '',
      fraction: fracs[j]!,
    }))
    .filter((c) => c.fraction > 0)
    .sort((a, b) => b.fraction - a.fraction);

  // Build a default + excludingFixing pair from a fully-sorted card list. The
  // toggle in the UI swaps between these precomputed slices, so neither list
  // ever falls short of the display count due to filtering.
  const TOP_N = 12;
  const buildRanked = (sortedCards: SkeletonCard[]): RankedCards => ({
    default: sortedCards.slice(0, TOP_N),
    excludingFixing: sortedCards
      .filter((c) => !cardMeta[c.oracle_id]?.isManaFixingLand)
      .slice(0, TOP_N),
  });

  const coreCards = buildRanked(allCards);

  // identityCards is filled in a second pass (assignIdentityCards) so it can
  // do cross-cluster highest-bidder assignment.

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

  return {
    clusterId,
    colorProfile,
    poolCount,
    poolIndices,
    coreCards,
    occasionalCards,
    sideboardCards,
    lockPairs: lockPairs.slice(0, 5),
  };
}

/**
 * Distinct cards: a single tab per cluster whose contents are guaranteed
 * disjoint from every Staples (coreCards) tab AND every other Distinct tab on
 * the page.
 *
 * Algorithm:
 *   1. Score every (card, cluster) pair: cosine(card_emb, cluster_centroid) ×
 *      log(1 + lift_in_that_cluster), with a fraction > 0.10 floor.
 *   2. Highest-bidder: each card is assigned to the cluster where it scores
 *      highest. Within each cluster, sort assigned cards by score, drop any
 *      that already appear in this cluster's coreCards, take top 12.
 *   3. Fallback for sparse clusters: if a cluster ends up with < 12 cards
 *      after step 2, fill remaining slots from this cluster's sorted candidates
 *      (allowing cards already claimed by other clusters), still excluding own
 *      coreCards. The fallback should rarely fire in practice.
 *
 * Mutates each skeleton in place to attach `identityCards`.
 * Identity cards: appear in >THRESHOLD fraction of cluster decks,
 * sorted by cosine(card_embedding, centroid) descending.
 */
function assignIdentityCards(ctx: SkeletonScoringContext, skeletons: ArchetypeSkeleton[]): void {
  const { oracleIds, cardMeta, cardEmbeddings, embeddings, embDim, clusterFracsMap } = ctx;

  if (!cardEmbeddings || !embeddings || embDim === 0) {
    for (const skel of skeletons) skel.identityCards = { default: [], excludingFixing: [] };
    return;
  }

  const THRESHOLD = 0.05; // >5% of cluster decks must include the card
  const TOP_N = 12;

  // Per-cluster L2-normalized centroid of pool embeddings.
  const centroidsByCluster = new Map<number, Float32Array>();
  for (const skel of skeletons) {
    if (skel.poolIndices.length === 0) continue;
    const c = new Float32Array(embDim);
    for (const pi of skel.poolIndices) {
      const e = embeddings[pi]!;
      for (let k = 0; k < embDim; k++) c[k] += e[k]!;
    }
    for (let k = 0; k < embDim; k++) c[k] /= skel.poolIndices.length;
    let cnorm = 0;
    for (let k = 0; k < embDim; k++) cnorm += c[k]! * c[k]!;
    cnorm = Math.sqrt(cnorm);
    if (cnorm > 0) for (let k = 0; k < embDim; k++) c[k] /= cnorm;
    centroidsByCluster.set(skel.clusterId, c);
  }

  for (const skel of skeletons) {
    const fracs = clusterFracsMap.get(skel.clusterId);
    const centroid = centroidsByCluster.get(skel.clusterId);
    if (!fracs || !centroid) {
      skel.identityCards = { default: [], excludingFixing: [] };
      continue;
    }

    // Candidates: cards above presence threshold with a valid embedding.
    type Scored = { j: number; cosine: number };
    const candidates: Scored[] = [];
    for (let j = 0; j < oracleIds.length; j++) {
      if (fracs[j]! <= THRESHOLD) continue;
      const ce = cardEmbeddings[j];
      if (!ce) continue;
      let cosine = 0;
      for (let k = 0; k < embDim; k++) cosine += ce[k]! * centroid[k]!;
      candidates.push({ j, cosine });
    }
    // Sort by inclusion rate (fraction) descending — most-drafted cards first.
    candidates.sort((a, b) => fracs[b.j]! - fracs[a.j]!);

    const skeletonCard = (j: number): SkeletonCard => ({
      oracle_id: oracleIds[j]!,
      name: cardMeta[oracleIds[j]!]?.name ?? oracleIds[j]!,
      imageUrl: cardMeta[oracleIds[j]!]?.imageUrl ?? '',
      fraction: fracs[j]!,
    });

    const buildVariant = (excludeFixing: boolean, coreIds: Set<string>): SkeletonCard[] => {
      const out: SkeletonCard[] = [];
      for (const { j } of candidates) {
        if (out.length >= TOP_N) break;
        const oid = oracleIds[j]!;
        if (coreIds.has(oid)) continue;
        if (excludeFixing && cardMeta[oid]?.isManaFixingLand) continue;
        out.push(skeletonCard(j));
      }
      return out;
    };

    const coreDefaultIds = new Set(skel.coreCards.default.map((c) => c.oracle_id));
    const coreExcludingFixingIds = new Set(skel.coreCards.excludingFixing.map((c) => c.oracle_id));
    skel.identityCards = {
      default: buildVariant(false, coreDefaultIds),
      excludingFixing: buildVariant(true, coreExcludingFixingIds),
    };
  }
}

export function computeSkeletons(
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  embeddings: number[][] | null,
  deckBuilds?: BuiltDeck[] | null,
  knnK: number = 50,
  negSamples: number = 20,
  resolution: number = 1.0,
): { skeletons: ArchetypeSkeleton[]; umapCoords: { x: number; y: number }[]; clusterMethod: string } {
  const n = slimPools.length;
  if (n === 0) return { skeletons: [], umapCoords: [], clusterMethod: 'leiden' };

  // Exclude basic lands so the high-dim space and binary vectors agree on dim.
  const oracleIds = Object.keys(cardMeta).filter((id) => {
    const t = (cardMeta[id]?.type ?? '').toLowerCase();
    return !(t.includes('basic') && t.includes('land'));
  });
  const oracleIndex = new Map(oracleIds.map((id, i) => [id, i]));
  const dim = oracleIds.length;

  const hasDecks = !!(deckBuilds && deckBuilds.length === n);
  const binaryVecs: Uint8Array[] = slimPools.map((pool, i) => {
    const v = new Uint8Array(dim);
    const cards = hasDecks ? deckBuilds![i]!.mainboard : pool.picks.map((p) => p.oracle_id);
    for (const oracle_id of cards) {
      const idx = oracleIndex.get(oracle_id);
      if (idx !== undefined) v[idx] = 1;
    }
    return v;
  });

  // Choose the high-dimensional vectors for clustering and UMAP
  let rawVecs: number[][];
  if (embeddings && embeddings.length === n) {
    rawVecs = embeddings;
  } else {
    const df = new Float32Array(dim);
    for (const v of binaryVecs) for (let j = 0; j < dim; j++) if (v[j]) df[j]++;
    const idf = Float32Array.from({ length: dim }, (_, j) => Math.log((n + 1) / (df[j]! + 1)));
    rawVecs = binaryVecs.map((v) => {
      const vec = Array.from({ length: dim }, (_, j) => v[j]! * idf[j]!);
      const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
      return norm > 0 ? vec.map((x) => x / norm) : vec;
    });
  }

  const rng = createRng(deriveClusterSeed(slimPools));
  const knnGraph = buildKnnGraph(rawVecs, Math.min(knnK, n - 1), 'cosine');
  const assignments = leidenAssignments(knnGraph, n, resolution, rng);
  const clusterMethod = `leiden (γ=${resolution})`;

  const vizRng = createRng(deriveClusterSeed(slimPools) ^ 0x5a5a5a5a);
  const umapCoords = approximateUmap(rawVecs, knnGraph.edges, negSamples, vizRng);

  const uniqueClusters = [...new Set(assignments)].sort((a, b) => a - b);
  const clusters = uniqueClusters.map((clusterId) => ({
    clusterId,
    poolIndices: assignments.map((a, i) => (a === clusterId ? i : -1)).filter((i) => i >= 0),
  }));

  const ctx = buildScoringContext(slimPools, cardMeta, embeddings, deckBuilds, clusters);
  const skeletons: ArchetypeSkeleton[] = [];
  for (const { clusterId, poolIndices } of clusters) {
    const skel = scoreClusterSkeleton(ctx, clusterId, poolIndices);
    if (skel) skeletons.push(skel);
  }
  assignIdentityCards(ctx, skeletons);

  return {
    skeletons: skeletons.sort((a, b) => b.poolCount - a.poolCount),
    umapCoords,
    clusterMethod,
  };
}

export function buildClusterRecommendationInput(
  skeleton: ArchetypeSkeleton,
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  deckBuilds?: BuiltDeck[] | null,
): { seedOracles: string[]; minSeedCount: number } {
  const hasDecks = !!(deckBuilds && deckBuilds.length === slimPools.length);
  const totalClusterPools = skeleton.poolIndices.length;
  if (totalClusterPools === 0) {
    return { seedOracles: [], minSeedCount: 0 };
  }

  const counts = new Map<string, number>();
  for (const poolIndex of skeleton.poolIndices) {
    const cards = hasDecks
      ? deckBuilds?.[poolIndex]?.mainboard ?? []
      : slimPools[poolIndex]?.picks.map((pick) => pick.oracle_id) ?? [];
    for (const oracle of new Set(cards)) {
      const type = cardMeta[oracle]?.type ?? '';
      if (type.includes('Basic') && type.includes('Land')) continue;
      counts.set(oracle, (counts.get(oracle) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()]
    .map(([oracle, count]) => ({
      oracle,
      count,
      fraction: count / totalClusterPools,
    }))
    .sort((a, b) => b.fraction - a.fraction || a.oracle.localeCompare(b.oracle));

  const minSeedCount = Math.max(2, Math.ceil(skeleton.poolCount * 0.1));
  const frequentCards = ranked.filter((card) => card.count >= minSeedCount);
  const seedCards = frequentCards.length >= 20 ? frequentCards : ranked.slice(0, 40);
  return {
    seedOracles: seedCards.slice(0, 120).map((card) => card.oracle),
    minSeedCount,
  };
}

/**
 * Recompute per-cluster card scoring on top of an existing set of skeletons.
 * Reuses the cluster assignments stored in `existingSkeletons[i].poolIndices`,
 * so it skips the expensive k-NN/UMAP/Leiden work in `computeSkeletons` and
 * only redoes the per-cluster card math. Use this to bring a cached run up to
 * date with the current scoring algorithms (e.g. after adding new variants).
 */
export function rescoreSkeletons(
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  embeddings: number[][] | null,
  deckBuilds: BuiltDeck[] | null | undefined,
  existingSkeletons: ArchetypeSkeleton[],
): ArchetypeSkeleton[] {
  if (slimPools.length === 0 || existingSkeletons.length === 0) return existingSkeletons;
  const clusters = existingSkeletons.map((s) => ({
    clusterId: s.clusterId,
    poolIndices: s.poolIndices.filter((poolIndex) => Number.isInteger(poolIndex) && poolIndex >= 0 && poolIndex < slimPools.length),
  }));
  const existingByClusterId = new Map(existingSkeletons.map((s) => [s.clusterId, s]));
  const ctx = buildScoringContext(slimPools, cardMeta, embeddings, deckBuilds, clusters);
  const out: ArchetypeSkeleton[] = [];
  for (const { clusterId, poolIndices } of clusters) {
    const skel = scoreClusterSkeleton(ctx, clusterId, poolIndices);
    if (skel) {
      const existing = existingByClusterId.get(clusterId);
      if (existing?.recommendedAdds) skel.recommendedAdds = existing.recommendedAdds;
      out.push(skel);
    }
  }
  assignIdentityCards(ctx, out);
  return out.sort((a, b) => b.poolCount - a.poolCount);
}
