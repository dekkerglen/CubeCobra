
// Mirrors the responses of /tool/api/mlplayground/* (see server serverutils/mlPlayground).

// What the model is given for a pasted card: the card itself, a stand-in, or nothing.
export type ModelStatus = 'known' | 'substituted' | 'unknown';

export interface PlaygroundCard {
  cardID: string;
  oracle: string;
  name: string;
  count: number;
  status: ModelStatus;
  substituteID?: string;
  substituteName?: string;
}

export interface ListSummary {
  cards: PlaygroundCard[];
  missing: string[];
}

export interface RatedCard {
  cardID: string;
  oracle: string;
  name: string;
  // null when the model gave the card no rating.
  rating: number | null;
}

export interface DeckCard {
  cardID: string;
  name: string;
}

export interface RecommendResponse {
  list?: ListSummary;
  cuts?: RatedCard[];
  adds: RatedCard[];
  totalAdds: number;
}

export interface DraftResponse {
  pack: ListSummary;
  pool: ListSummary;
  picks: RatedCard[];
}

export interface DeckbuildResponse {
  pool: ListSummary;
  buildRatings: RatedCard[];
  mainboard: DeckCard[];
  sideboard: DeckCard[];
  colors: string[];
  archetype: string | null;
}

export interface ArchetypeScore {
  label: string;
  score: number;
}

export interface ArchetypeResult {
  list: ListSummary;
  embedding: number[];
  colors: string[];
  // share: of the list's archetype topics. similarity: cosine to the closest legacy cluster center.
  scoreKind: 'share' | 'similarity';
  archetypes: ArchetypeScore[];
}

export interface ArchetypeResponse {
  results: ArchetypeResult[];
  similarity: number | null;
}

export type PlaygroundErrorKind = 'ml-unavailable' | 'rate-limited' | 'invalid' | 'generic';

export interface PlaygroundError {
  kind: PlaygroundErrorKind;
  message: string;
}

// One item in a results view. `rating` is left out where there is no score to show.
export interface ResultItem {
  cardID: string;
  name: string;
  rating?: number | null;
  count?: number;
}
