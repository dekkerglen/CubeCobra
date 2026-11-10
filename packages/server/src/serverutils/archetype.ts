/**
 * Deck archetype classification using cluster centers and annotations.
 *
 * The cluster centers (embeddings in the served model's space) and archetype labels come from the
 * served model bundle, or the static files when it has none (see modelPointer). Classifies a deck
 * by encoding its oracle IDs via the ML service, then finding the closest cluster center via cosine
 * similarity.
 */
import { archetypeForEmbedding, type ArchetypeMatch, rankArchetypes } from '@utils/drafting/archetype';

import { encode } from './ml';
import { getArchetypeData } from './modelPointer';

/**
 * Classify a deck into the closest archetype cluster.
 * @param oracleIds - Unique oracle IDs of the cards in the deck's mainboard
 * @returns The archetype label, or null if classification fails
 */
export async function classifyDeck(oracleIds: string[]): Promise<string | null> {
  const { centers, annotations } = getArchetypeData();

  if (centers.length === 0 || oracleIds.length === 0) {
    return null;
  }

  try {
    const embedding = await encode(oracleIds);
    return archetypeForEmbedding(embedding, centers, annotations);
  } catch {
    return null;
  }
}

/** Every archetype label ranked by its closest cluster center to `embedding` (cosine). */
export function rankArchetypesForEmbedding(embedding: number[]): ArchetypeMatch[] {
  const { centers, annotations } = getArchetypeData();
  return rankArchetypes(embedding, centers, annotations);
}
