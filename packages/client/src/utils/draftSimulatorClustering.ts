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
        const lambda = dist > 1e-10 ? 1 / dist : 1e10;
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

function buildKnnGraph(vectors: number[][], neighborCount: number): KNNGraph {
  const n = vectors.length;
  const edges: KNNEdge[] = [];
  const neighbors: { index: number; dist: number }[][] = [];
  for (let i = 0; i < n; i++) {
    const distances: { index: number; distance: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distances.push({ index: j, distance: euclidSq(vectors[i]!, vectors[j]!) });
    }
    distances.sort((a, b) => a.distance - b.distance);
    const kNeighbors = distances.slice(0, neighborCount);
    neighbors.push(kNeighbors.map((d) => ({ index: d.index, dist: Math.sqrt(d.distance) })));
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
// computeSkeletons — HDBSCAN on UMAP-Nd vectors, UMAP-2D for visualization
// ---------------------------------------------------------------------------

/**
 * Compute archetype clusters from deck embeddings.
 *
 * Flow:
 *   1. Build k-NN graph on the high-dimensional vectors (shared).
 *   2. UMAP to pcaDims dimensions for clustering (creates density contrast).
 *   3. HDBSCAN on the UMAP-reduced vectors.
 *   4. UMAP to 2D for scatter plot visualization (reuses k-NN graph).
 *   5. Extract archetype skeleton metadata (core cards, sideboard, etc.)
 *
 * @param slimPools      Slim pool data for each seat
 * @param cardMeta       Card metadata keyed by oracle_id
 * @param minClusterSize Minimum number of points for a group to be a cluster
 * @param embeddings     128-dim embeddings from the ML encoder (one per pool), or null
 *                       to fall back to TF-IDF clustering
 * @param deckBuilds     Optional built decks (mainboard/sideboard)
 * @param umapDims       UMAP target dimensions for clustering (default 20, only used in 'umap' mode)
 * @param minPts         Neighbors for density smoothing (default 3)
 * @param clusterMode    'umap' = UMAP-Nd then HDBSCAN, 'graph' = HDBSCAN directly on k-NN graph
 * @param knnK           Number of neighbors in k-NN graph (default 50)
 * @param negSamples     Negative samples per edge in UMAP (default 20)
 */
export function computeSkeletons(
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  minClusterSize: number,
  embeddings: number[][] | null,
  deckBuilds?: BuiltDeck[] | null,
  umapDims: number = 20,
  minPts: number = 3,
  clusterMode: 'umap' | 'graph' = 'umap',
  knnK: number = 50,
  negSamples: number = 20,
): { skeletons: ArchetypeSkeleton[]; umapCoords: { x: number; y: number }[]; clusterMethod: string } {
  const n = slimPools.length;
  if (n === 0) return { skeletons: [], umapCoords: [], clusterMethod: 'hdbscan (umap)' };

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
  let rawVecs: number[][];
  if (embeddings && embeddings.length === n) {
    rawVecs = embeddings;
  } else {
    // Fallback: TF-IDF vectors
    const df = new Float32Array(dim);
    for (const v of vecs) for (let j = 0; j < dim; j++) if (v[j]) df[j]++;
    const idf = Float32Array.from({ length: dim }, (_, j) => Math.log((n + 1) / (df[j]! + 1)));
    rawVecs = vecs.map((v) => {
      const vec = Array.from({ length: dim }, (_, j) => v[j]! * idf[j]!);
      const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
      return norm > 0 ? vec.map((x) => x / norm) : vec;
    });
  }

  // Deterministic seeded RNG derived from pool data
  const rng = createRng(deriveClusterSeed(slimPools));

  // Build k-NN graph once (shared between clustering and visualization)
  const knnGraph = buildKnnGraph(rawVecs, Math.min(knnK, n - 1));

  let assignments: number[];
  let clusterMethod: string;

  if (clusterMode === 'graph') {
    // Graph-based: HDBSCAN directly on k-NN graph (no dimensionality reduction)
    assignments = hdbscanFromKnnGraph(knnGraph, n, minClusterSize, minPts, rawVecs);
    clusterMethod = 'hdbscan (graph)';

    const uniqueFromHdbscan = new Set(assignments);
    if (uniqueFromHdbscan.size <= 1 && n >= 4) {
      const k = Math.max(2, Math.min(12, Math.floor(Math.sqrt(n / 2))));
      assignments = kmeansAssignments(rawVecs, k, 30, rng);
      clusterMethod = 'kmeans (fallback)';
    }
  } else {
    // UMAP-Nd: reduce to umapDims, then HDBSCAN
    const clusterVecs = umapProject(knnGraph.edges, n, umapDims, rawVecs, negSamples, 90, rng);
    assignments = hdbscanAssignments(clusterVecs, minClusterSize, minPts);
    clusterMethod = `hdbscan (umap-${umapDims}d)`;

    const uniqueFromHdbscan = new Set(assignments);
    if (uniqueFromHdbscan.size <= 1 && n >= 4) {
      const k = Math.max(2, Math.min(12, Math.floor(Math.sqrt(n / 2))));
      assignments = kmeansAssignments(clusterVecs, k, 30, rng);
      clusterMethod = 'kmeans (fallback)';
    }
  }

  // UMAP to 2D for visualization (reuses k-NN graph, separate rng for independence)
  const vizRng = createRng(deriveClusterSeed(slimPools) ^ 0x5a5a5a5a);
  const umapCoords = approximateUmap(rawVecs, knnGraph.edges, negSamples, vizRng);

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
    clusterMethod,
  };
}
