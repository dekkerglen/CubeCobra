/**
 * Deck archetype classification with the served archetypes (see modelPointer): topic archetypes
 * classify a deck from its cards' oracle tags alone (@utils/drafting/topicArchetypes). While the
 * served version has no archetypes, nothing is classified.
 */
import { classifyByTopics, rankTopicArchetypes } from '@utils/drafting/topicArchetypes';

import { getArchetypeData } from './modelPointer';

/**
 * Classify a deck into its archetype.
 * @param oracleIds - Unique oracle IDs of the cards in the deck's mainboard
 * @returns The archetype label, or null when the deck can't be classified
 */
export async function classifyDeck(oracleIds: string[]): Promise<string | null> {
  const data = getArchetypeData();
  if (!data || oracleIds.length === 0) return null;
  return classifyByTopics(oracleIds, data.topics, data.names);
}

/** classifyDeck for many decks. */
export async function classifyDecks(oracleIdsPerDeck: string[][]): Promise<(string | null)[]> {
  const data = getArchetypeData();
  if (!data) return oracleIdsPerDeck.map(() => null);
  return oracleIdsPerDeck.map((oracleIds) => classifyByTopics(oracleIds, data.topics, data.names));
}

export interface ArchetypeScore {
  label: string;
  // The archetype's share of the list's topic weight.
  score: number;
}

/** Every archetype label for a card list, best first; empty when the served version has none. */
export async function rankArchetypesForOracles(oracleIds: string[]): Promise<ArchetypeScore[]> {
  const data = getArchetypeData();
  if (!data) return [];
  return rankTopicArchetypes(oracleIds, data.topics, data.names).map(({ label, share }) => ({ label, score: share }));
}
