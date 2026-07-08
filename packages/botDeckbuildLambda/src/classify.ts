import { archetypeForEmbedding, type ClusterCenter } from '@utils/drafting/archetype';
import fs from 'fs';
import path from 'path';

import { batchEncode } from './ml';

/**
 * Deck archetype classification for bot seats. The cluster centers + annotations are the
 * small static files copied next to the bundle (see esbuild.config.js); the nearest-cluster
 * math is shared with the server via @utils/drafting/archetype. Encoding is batched so a
 * whole SQS batch of decks costs one /batchencode call rather than one /encode per seat.
 */
let clusterCenters: ClusterCenter[] = [];
let annotations: Record<string, string> = {};
let loaded = false;

const loadData = (): void => {
  if (loaded) return;
  try {
    const dir = __dirname;
    const centersPath = path.join(dir, 'clusterCenters.json');
    const annotationsPath = path.join(dir, 'annotations.json');
    if (fs.existsSync(centersPath)) clusterCenters = JSON.parse(fs.readFileSync(centersPath, 'utf8'));
    if (fs.existsSync(annotationsPath)) annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
  } catch (err) {
    console.warn('bot-deckbuild: failed to load archetype data', err);
  }
  loaded = true;
};

/**
 * Classify many decks at once. Returns an archetype label (or null) per input deck, in order.
 * A single batched /encode call covers every deck.
 */
export const classifyDecks = async (oracleIdsPerDeck: string[][]): Promise<(string | null)[]> => {
  loadData();
  if (clusterCenters.length === 0) return oracleIdsPerDeck.map(() => null);

  try {
    const embeddings = await batchEncode(oracleIdsPerDeck);
    return oracleIdsPerDeck.map((oracleIds, i) =>
      oracleIds.length === 0 ? null : archetypeForEmbedding(embeddings[i], clusterCenters, annotations),
    );
  } catch {
    return oracleIdsPerDeck.map(() => null);
  }
};
