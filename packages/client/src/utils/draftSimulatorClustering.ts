import { ArchetypeSkeleton, BuiltDeck, CardMeta, LockPair, SkeletonCard, SlimPool } from '@utils/datatypes/SimulationReport';

export function euclidSq(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
  return s;
}

export function kMeans(vecs: number[][], k: number): number[] {
  const n = vecs.length;
  if (n === 0) return [];
  k = Math.min(k, n);
  const dim = vecs[0]?.length ?? 0;

  // K-means++ init
  const seedIdxs: number[] = [Math.floor(Math.random() * n)];
  while (seedIdxs.length < k) {
    const dists = vecs.map((v) => Math.min(...seedIdxs.map((si) => euclidSq(v, vecs[si]!))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, chosen = n - 1;
    for (let i = 0; i < n; i++) { r -= dists[i]!; if (r <= 0) { chosen = i; break; } }
    seedIdxs.push(chosen);
  }

  let centroids: number[][] = seedIdxs.map((i) => [...vecs[i]!]);
  const assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) { const d = euclidSq(vecs[i]!, centroids[c]!); if (d < bestD) { bestD = d; best = c; } }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    centroids = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) { const c = assignments[i]!; counts[c]++; for (let j = 0; j < dim; j++) centroids[c]![j]! += vecs[i]![j]!; }
    for (let c = 0; c < k; c++) { const cnt = counts[c]; if (cnt > 0) centroids[c] = centroids[c]!.map((v) => v / cnt); }
  }

  return assignments;
}

export function computeSkeletons(
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  k: number,
  coreThresholdPct: number = 60,
  deckBuilds?: BuiltDeck[] | null,
): ArchetypeSkeleton[] {
  const n = slimPools.length;
  if (n === 0) return [];
  k = Math.min(k, n); // can't have more clusters than data points

  // Exclude basic lands — they appear in almost every deck and distort clustering
  const oracleIds = Object.keys(cardMeta).filter((id) => {
    const t = (cardMeta[id]?.type ?? '').toLowerCase();
    return !(t.includes('basic') && t.includes('land'));
  });
  const oracleIndex = new Map(oracleIds.map((id, i) => [id, i]));
  const dim = oracleIds.length;

  // Use mainboard decks when available, fall back to draft picks
  const hasDecks = deckBuilds && deckBuilds.length === n;
  const vecs: Uint8Array[] = slimPools.map((pool, i) => {
    const v = new Uint8Array(dim);
    const cards = hasDecks ? deckBuilds![i]!.mainboard : pool.picks.map((p) => p.oracle_id);
    for (const oracle_id of cards) { const idx = oracleIndex.get(oracle_id); if (idx !== undefined) v[idx] = 1; }
    return v;
  });

  // IDF: cards drafted in most pools get low weight, distinguishing cards get high weight
  const df = new Float32Array(dim);
  for (const v of vecs) for (let j = 0; j < dim; j++) if (v[j]) df[j]++;
  const idf = Float32Array.from({ length: dim }, (_, j) => Math.log((n + 1) / (df[j]! + 1)));

  // TF-IDF vectors, L2-normalised → cosine similarity via Euclidean k-means
  const tfidfVecs: number[][] = vecs.map((v) => {
    const vec = Array.from({ length: dim }, (_, j) => v[j]! * idf[j]!);
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    return norm > 0 ? vec.map((x) => x / norm) : vec;
  });
  const assignments = kMeans(tfidfVecs, k);

  const skeletons: ArchetypeSkeleton[] = [];
  for (let clusterId = 0; clusterId < k; clusterId++) {
    const poolIndices = assignments.map((a, i) => (a === clusterId ? i : -1)).filter((i) => i >= 0);
    const poolCount = poolIndices.length;
    if (poolCount === 0) continue;

    // Centroid card fractions: for each card, what fraction of pools in this cluster drafted it
    const fracs = new Float32Array(dim);
    for (const pi of poolIndices) { const v = vecs[pi]!; for (let j = 0; j < dim; j++) fracs[j] += v[j]!; }
    for (let j = 0; j < dim; j++) fracs[j] /= poolCount;

    const allCards: SkeletonCard[] = oracleIds
      .map((oracle_id, j) => ({ oracle_id, name: cardMeta[oracle_id]?.name ?? oracle_id, imageUrl: cardMeta[oracle_id]?.imageUrl ?? '', fraction: fracs[j]! }))
      .filter((c) => c.fraction >= coreThresholdPct / 2 / 100)
      .sort((a, b) => b.fraction - a.fraction);

    const coreThresholdFrac = coreThresholdPct / 100;
    const coreCards = allCards.filter((c) => c.fraction >= coreThresholdFrac).slice(0, 24);
    const occasionalCards = allCards.filter((c) => c.fraction < coreThresholdFrac).slice(0, 12);

    // Color profile
    const colorWeight: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let totalWeight = 0;
    for (const { oracle_id, fraction } of coreCards) {
      const colors = cardMeta[oracle_id]?.colorIdentity ?? [];
      if (colors.length === 0) continue;
      totalWeight += fraction;
      for (const c of colors) if (c in colorWeight) colorWeight[c] += fraction;
    }
    const colorProfile = Object.entries(colorWeight).filter(([, v]) => totalWeight > 0 && v / totalWeight > 0.2).sort((a, b) => b[1] - a[1]).map(([key]) => key).join('') || 'C';

    // Lock pairs
    const lockPairs: LockPair[] = [];
    const lockCandidates = allCards.filter((c) => c.fraction >= Math.max(0.25, coreThresholdFrac / 2)).slice(0, 24);
    for (let ai = 0; ai < lockCandidates.length; ai++) {
      for (let bi = ai + 1; bi < lockCandidates.length; bi++) {
        const a = lockCandidates[ai]!, b = lockCandidates[bi]!;
        const aIdx = oracleIndex.get(a.oracle_id)!, bIdx = oracleIndex.get(b.oracle_id)!;
        let both = 0;
        for (const pi of poolIndices) if (vecs[pi]![aIdx] && vecs[pi]![bIdx]) both++;
        const rate = both / poolCount;
        if (rate > 0.60 && rate > a.fraction * b.fraction + 0.05) {
          lockPairs.push({ oracle_id_a: a.oracle_id, oracle_id_b: b.oracle_id, nameA: a.name, nameB: b.name, coOccurrenceRate: rate });
        }
      }
    }
    lockPairs.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

    skeletons.push({ clusterId, colorProfile, poolCount, poolIndices, coreCards, occasionalCards, lockPairs: lockPairs.slice(0, 5) });
  }

  return skeletons.sort((a, b) => b.poolCount - a.poolCount);
}
