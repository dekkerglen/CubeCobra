/**
 * Deck archetype classification using cluster centers and annotations.
 *
 * Loads cluster centers (128-dim embeddings) and archetype labels from static files.
 * Classifies a deck by encoding its oracle IDs via the ML service, then finding
 * the closest cluster center via cosine similarity.
 */
import fs from 'fs';
import path from 'path';

import { encode } from './ml';

interface ClusterCenter {
  clusterId: number;
  center: number[];
}

const STATIC_DIR = path.join(__dirname, '..', 'static');

let clusterCenters: ClusterCenter[] = [];
let annotations: Record<string, string> = {};
let loaded = false;

function loadData() {
  if (loaded) return;

  try {
    const centersPath = path.join(STATIC_DIR, 'clusterCenters.json');
    const annotationsPath = path.join(STATIC_DIR, 'annotations.json');

    if (fs.existsSync(centersPath)) {
      clusterCenters = JSON.parse(fs.readFileSync(centersPath, 'utf8'));
    } else {
      console.warn('clusterCenters.json not found, archetype classification disabled');
    }

    if (fs.existsSync(annotationsPath)) {
      annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
    } else {
      console.warn('annotations.json not found, archetype classification disabled');
    }

    loaded = true;
    console.info(`Loaded ${clusterCenters.length} cluster centers, ${Object.keys(annotations).length} annotations`);
  } catch (err) {
    console.warn('Failed to load archetype data:', err);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Classify a deck into the closest archetype cluster.
 * @param oracleIds - Unique oracle IDs of the cards in the deck's mainboard
 * @returns The archetype label, or null if classification fails
 */
export async function classifyDeck(oracleIds: string[]): Promise<string | null> {
  loadData();

  if (clusterCenters.length === 0 || oracleIds.length === 0) {
    return null;
  }

  try {
    const embedding = await encode(oracleIds);

    if (!embedding || embedding.length === 0) {
      return null;
    }

    let bestClusterId = -1;
    let bestSimilarity = -Infinity;

    for (const { clusterId, center } of clusterCenters) {
      const sim = cosineSimilarity(embedding, center);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestClusterId = clusterId;
      }
    }

    if (bestClusterId < 0) {
      return null;
    }

    return annotations[String(bestClusterId)] || null;
  } catch {
    return null;
  }
}
