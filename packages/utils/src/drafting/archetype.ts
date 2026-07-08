/**
 * Pure archetype-classification math shared by the server (serverutils/archetype) and the
 * bot-deckbuild lambda. Both encode a deck's oracle ids via the ML service, then map the
 * embedding to the nearest cluster center here — keeping the metric in one place so the two
 * callers can't drift.
 */
export interface ClusterCenter {
  clusterId: number;
  center: number[];
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

/** The clusterId of the center closest (cosine) to `embedding`, or -1 if none. */
export const nearestClusterId = (embedding: number[], clusterCenters: ClusterCenter[]): number => {
  let bestClusterId = -1;
  let bestSimilarity = -Infinity;
  for (const { clusterId, center } of clusterCenters) {
    const sim = cosineSimilarity(embedding, center);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestClusterId = clusterId;
    }
  }
  return bestClusterId;
};

/** Archetype label for an embedding given the cluster centers + labels, or null if unavailable. */
export const archetypeForEmbedding = (
  embedding: number[] | null | undefined,
  clusterCenters: ClusterCenter[],
  annotations: Record<string, string>,
): string | null => {
  if (!embedding || embedding.length === 0 || clusterCenters.length === 0) return null;
  const clusterId = nearestClusterId(embedding, clusterCenters);
  if (clusterId < 0) return null;
  return annotations[String(clusterId)] || null;
};
