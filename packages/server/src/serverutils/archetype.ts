/**
 * Deck archetype classification with the served archetypes (see modelPointer).
 *
 * Topic archetypes classify a deck from its cards' oracle tags alone (@utils/drafting/topicArchetypes).
 * The legacy embedding cluster centers (model v3) encode the deck via the ML service and take the
 * closest center by cosine similarity.
 */
import { archetypeForEmbedding, rankArchetypes } from '@utils/drafting/archetype';
import { classifyByTopics, rankTopicArchetypes } from '@utils/drafting/topicArchetypes';

import { batchEncodeOrThrow, encode } from './ml';
import { getArchetypeData } from './modelPointer';

// Supplies the deck's embedding for the legacy centers, when the caller has a better input for the
// encoder than the deck's own oracle ids (substitutes for cards the model doesn't know).
type Embedder = () => Promise<number[]>;

/**
 * Classify a deck into its archetype.
 * @param oracleIds - Unique oracle IDs of the cards in the deck's mainboard
 * @returns The archetype label, or null if classification fails
 */
export async function classifyDeck(oracleIds: string[], embed?: Embedder): Promise<string | null> {
  const data = getArchetypeData();
  if (oracleIds.length === 0) return null;
  if (data.kind === 'topics') {
    return classifyByTopics(oracleIds, data.topics, data.names);
  }
  if (data.centers.length === 0) return null;

  try {
    const embedding = embed ? await embed() : await encode(oracleIds);
    return archetypeForEmbedding(embedding, data.centers, data.annotations);
  } catch {
    return null;
  }
}

/** classifyDeck for many decks; the legacy centers path makes one batched encode call. */
export async function classifyDecks(oracleIdsPerDeck: string[][]): Promise<(string | null)[]> {
  const data = getArchetypeData();
  if (data.kind === 'topics') {
    return oracleIdsPerDeck.map((oracleIds) => classifyByTopics(oracleIds, data.topics, data.names));
  }
  if (data.centers.length === 0 || oracleIdsPerDeck.length === 0) return oracleIdsPerDeck.map(() => null);

  try {
    const embeddings = await batchEncodeOrThrow(oracleIdsPerDeck);
    return oracleIdsPerDeck.map((oracleIds, index) =>
      oracleIds.length === 0 ? null : archetypeForEmbedding(embeddings[index], data.centers, data.annotations),
    );
  } catch {
    return oracleIdsPerDeck.map(() => null);
  }
}

export interface ArchetypeScore {
  label: string;
  score: number;
}

export interface ArchetypeRanking {
  // share: the archetype's share of the list's topic weight. similarity: cosine to its nearest center.
  scoreKind: 'share' | 'similarity';
  archetypes: ArchetypeScore[];
}

/** Every archetype label for a card list, best first. */
export async function rankArchetypesForOracles(oracleIds: string[], embed?: Embedder): Promise<ArchetypeRanking> {
  const data = getArchetypeData();
  if (data.kind === 'topics') {
    return {
      scoreKind: 'share',
      archetypes: rankTopicArchetypes(oracleIds, data.topics, data.names).map(({ label, share }) => ({
        label,
        score: share,
      })),
    };
  }
  const embedding = embed ? await embed() : await encode(oracleIds);
  return {
    scoreKind: 'similarity',
    archetypes: rankArchetypes(embedding, data.centers, data.annotations).map(({ label, similarity }) => ({
      label,
      score: similarity,
    })),
  };
}
