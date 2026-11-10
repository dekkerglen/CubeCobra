/**
 * Archetypes as topics over Scryfall oracle tags. Each retrain, packages/ml/ccml/topics.py factors
 * recent decks' nonland tag counts into topics and ccml/name_topics.py names them; the result ships
 * in the model bundle as archetypes/topics.json and archetypes/names.json (see @utils/ml/modelBundle).
 *
 * A deck or card list is classified from its cards alone: each tagged nonland card brings its top
 * topics, and the list's profile is their sum. No recommender call is needed, so the server, the
 * bot-deckbuild lambda and the evaluate stage share these functions.
 *
 * Topic ids are only meaningful within one bundle; anything stored should store the name.
 */

export const ARCHETYPE_TOPICS_FORMAT = 1;

// Below this many tagged nonland cards, a deck says too little to name an archetype.
export const MIN_TAGGED_CARDS = 8;

export interface ArchetypeTopicShape {
  avgManaValue: number;
  creatureShare: number;
  instantSorceryShare: number;
}

export interface ArchetypeTopic {
  id: string;
  // Highest-weighted tags, most important first.
  topTags: string[];
  // Names of the nonland cards that load on the topic most heavily.
  cards: string[];
  // Share of training decks whose dominant topic this is.
  deckShare: number;
  // Average makeup of those decks' nonland mainboards.
  shape: ArchetypeTopicShape;
}

export interface ArchetypeTopicsFile {
  format: number;
  k: number;
  createdAt: number;
  topics: ArchetypeTopic[];
  // Tagged nonland cards only, by oracle id: up to 3 [topic id, weight] pairs from the card's
  // normalized topic profile, heaviest first. Lands and untagged cards are absent.
  cardTopics: Record<string, [string, number][]>;
}

export type ArchetypeNameSource = 'auto' | 'llm' | 'edited';

export interface ArchetypeName {
  name: string;
  source: ArchetypeNameSource;
  // The placeholder built from the top tags, and the LLM's name when it gave one.
  auto: string;
  llm?: string;
  editedBy?: string;
  editedAt?: number;
}

export interface ArchetypeNamesFile {
  names: Record<string, ArchetypeName>;
  updatedAt: number;
}

export interface ArchetypeNamingOutcome {
  mode: 'llm' | 'auto-fallback';
  reason: string | null;
  // Topics named by the LLM, names carried over from admin edits, and how many the critic changed.
  named: number;
  carriedOver: number;
  criticRevised: number;
  total: number;
  modelId: string | null;
  createdAt: number;
}

export interface TopicProfile {
  // Unique cards that contributed (tagged nonland cards).
  tagged: number;
  weights: Map<string, number>;
}

export const topicProfile = (
  oracleIds: string[],
  cardTopics: ArchetypeTopicsFile['cardTopics'],
): TopicProfile => {
  const weights = new Map<string, number>();
  let tagged = 0;
  for (const oracleId of new Set(oracleIds)) {
    const entries = cardTopics[oracleId];
    if (!entries || entries.length === 0) continue;
    tagged += 1;
    for (const [topicId, weight] of entries) {
      weights.set(topicId, (weights.get(topicId) ?? 0) + weight);
    }
  }
  return { tagged, weights };
};

const nameFor = (names: ArchetypeNamesFile, topicId: string): string | null => names.names[topicId]?.name || null;

/** The deck's archetype: the name of its heaviest topic, or null under MIN_TAGGED_CARDS tagged cards. */
export const classifyByTopics = (
  oracleIds: string[],
  topics: ArchetypeTopicsFile,
  names: ArchetypeNamesFile,
): string | null => {
  const { tagged, weights } = topicProfile(oracleIds, topics.cardTopics);
  if (tagged < MIN_TAGGED_CARDS) return null;
  let best: string | null = null;
  let bestWeight = -Infinity;
  for (const [topicId, weight] of weights) {
    if (weight > bestWeight || (weight === bestWeight && best !== null && topicId < best)) {
      best = topicId;
      bestWeight = weight;
    }
  }
  return best === null ? null : nameFor(names, best);
};

export interface RankedArchetype {
  label: string;
  topicIds: string[];
  // Share of the list's total topic weight; shares across labels sum to 1.
  share: number;
}

/** Every archetype present in the list, by share. Topics that share a name are combined. */
export const rankTopicArchetypes = (
  oracleIds: string[],
  topics: ArchetypeTopicsFile,
  names: ArchetypeNamesFile,
): RankedArchetype[] => {
  const { weights } = topicProfile(oracleIds, topics.cardTopics);
  let total = 0;
  for (const weight of weights.values()) total += weight;
  if (total === 0) return [];
  const byLabel = new Map<string, RankedArchetype>();
  for (const [topicId, weight] of weights) {
    const label = nameFor(names, topicId);
    if (!label) continue;
    const entry = byLabel.get(label) ?? { label, topicIds: [], share: 0 };
    entry.topicIds.push(topicId);
    entry.share += weight / total;
    byLabel.set(label, entry);
  }
  return [...byLabel.values()].sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
};

export interface ListArchetype extends RankedArchetype {
  // Oracle ids from the list that contribute most to the archetype, heaviest first.
  topCards: string[];
}

/** What a card list (a cube) supports: ranked archetypes with the cards that carry each. */
export const listArchetypeProfile = (
  oracleIds: string[],
  topics: ArchetypeTopicsFile,
  names: ArchetypeNamesFile,
  cardsPerArchetype: number = 8,
): ListArchetype[] => {
  const unique = [...new Set(oracleIds)];
  return rankTopicArchetypes(unique, topics, names).map((archetype) => {
    const ids = new Set(archetype.topicIds);
    const contributions = unique
      .map((oracleId) => ({
        oracleId,
        weight: (topics.cardTopics[oracleId] ?? []).reduce((sum, [topicId, w]) => (ids.has(topicId) ? sum + w : sum), 0),
      }))
      .filter(({ weight }) => weight > 0)
      .sort((a, b) => b.weight - a.weight || a.oracleId.localeCompare(b.oracleId));
    return { ...archetype, topCards: contributions.slice(0, cardsPerArchetype).map(({ oracleId }) => oracleId) };
  });
};
