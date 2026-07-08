/**
 * Deck archetype classification using cluster centers and annotations.
 *
 * Loads cluster centers (128-dim embeddings) and archetype labels from static files.
 * Classifies a deck by encoding its oracle IDs via the ML service, then finding
 * the closest cluster center via cosine similarity.
 */
import { archetypeForEmbedding, type ClusterCenter } from '@utils/drafting/archetype';
import fs from 'fs';
import path from 'path';

import { encode } from './ml';

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
    return archetypeForEmbedding(embedding, clusterCenters, annotations);
  } catch {
    return null;
  }
}
