export interface CardStats {
  oracle_id: string;
  name: string;
  colorIdentity: string[];
  timesSeen: number;
  timesPicked: number;
  pickRate: number; // timesPicked / timesSeen
  avgPickPosition: number; // average 1-based pick within pack when picked (1 = first pick)
  wheelCount: number; // times picked at position > numSeats (went around the table)
  p1p1Count: number; // times picked as first pick of pack 1
  p1p1Seen: number; // times seen in an opening pack for pack 1 pick 1
  poolIndices: number[]; // indexes into slimPools / simulatedPools for pools containing this card
  elo: number; // card's Elo rating from the card database
}

export interface ColorBalance {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number; // colorless / lands
  [key: string]: number;
}

export interface ArchetypeEntry {
  colorPair: string; // e.g. "WU", "BRG", "C"
  count: number;
  percentage: number;
}

export interface P1P1Entry {
  oracle_id: string;
  name: string;
  count: number;
  percentage: number; // count / times the card appeared in a P1P1 pack
}

export interface SimulationTimingBreakdown {
  setupMs: number;
  modelLoadMs: number;
  simulationMs: number;
  deckbuildMs: number;
  saveMs: number;
  totalMs: number;
}

export interface SimulatedPickCard {
  oracle_id: string;
  name: string;
  imageUrl: string;
  packNumber: number; // 0-indexed pack number
  pickNumber: number; // 1-indexed pick within the pack
}

export interface SimulatedPool {
  poolIndex: number;
  draftIndex: number;
  seatIndex: number;
  archetype: string;
  picks: SimulatedPickCard[];
}

export interface CardMeta {
  name: string;
  imageUrl: string;
  colorIdentity: string[];
  elo: number;
  cmc: number;
  type: string;
  producedMana?: string[];
  parsedCost?: string[];
  /** Remapped oracle ID for ML inference — set when card is not in the training vocab. */
  mlOracleId?: string;
  /** Cube-specific tags from the Card object. */
  tags?: string[];
  /** Scryfall oracle tags for this card. */
  oracleTags?: string[];
  /** True for non-basic lands that produce 2+ colors or have fetch-style search-library oracle text. */
  isManaFixingLand?: boolean;
}

/** Basic land entry included in SimulationSetupResponse for client-side deckbuilding. */
export interface BasicLandInfo {
  oracleId: string;
  name: string;
  imageUrl: string;
  colorIdentity: string[];
  producedMana: string[];
  type: string;
}

/**
 * Slim pool persisted with a simulation run — pick sequence without redundant
 * name/imageUrl fields (those can be reconstructed from cardMeta at display time).
 */
export interface SlimPool {
  draftIndex: number;
  seatIndex: number;
  archetype: string;
  picks: { oracle_id: string; packNumber: number; pickNumber: number }[];
}

/** One entry in the per-cube run history index. */
export interface SimulationRunEntry {
  ts: number;
  generatedAt: string;
  numDrafts: number;
  numSeats: number;
  convergenceScore: number;
}

/** Persisted per run — aggregate stats + slim pools + card metadata. */
export interface SimulationSummary {
  cubeId: string;
  cubeName: string;
  numDrafts: number;
  numSeats: number;
  cardStats: CardStats[];
  colorBalance?: ColorBalance;
  archetypeDistribution: ArchetypeEntry[];
  p1p1Frequency?: P1P1Entry[]; // top 20 — computed but not currently displayed
  convergenceScore: number; // stdev of pickRates
  generatedAt: string; // ISO timestamp
  timings?: SimulationTimingBreakdown;
}

/**
 * Full run data for a saved simulation — extends SimulationSummary with
 * card metadata (for pool image reconstruction), slim pool pick sequences,
 * and pre-built deck builds for every pool.
 */
export interface SimulationRunData extends SimulationSummary {
  cardMeta: Record<string, CardMeta>;
  slimPools: SlimPool[];
  deckBuilds?: BuiltDeck[]; // one per slim pool, in order; absent on old runs
  setupData?: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'>; // enables exact filtered stat recomputation after reload
  randomTrashByPool?: string[][]; // ordered random-trash removals per pool; absent on old runs
}

/**
 * Full in-memory report (client session only) — adds reconstructed SimulatedPool[]
 * for immediate pool display without reconstruction overhead.
 */
export interface SimulationReport extends SimulationRunData {
  simulatedPools: SimulatedPool[];
}

/** Built deck for a simulated pool (oracle IDs). */
export interface BuiltDeck {
  mainboard: string[];
  sideboard: string[];
  deckbuildRatings?: { oracle: string; rating: number }[];
}

// ---------------------------------------------------------------------------
// Archetype skeleton clustering (client-side only, not persisted)
// ---------------------------------------------------------------------------

export interface SkeletonCard {
  oracle_id: string;
  name: string;
  imageUrl: string;
  fraction: number; // 0–1: fraction of pools in this cluster that drafted this card
}

export interface LockPair {
  oracle_id_a: string;
  oracle_id_b: string;
  nameA: string;
  nameB: string;
  imageUrlA?: string;
  imageUrlB?: string;
  coOccurrenceRate: number; // 0–1
}

/**
 * A pair of top-N ranked lists for a single scoring algorithm. The toggle in the UI
 * picks `excludingFixing` (with mana-fixing lands removed before slicing) vs `default`
 * (raw ranking). Both lists are precomputed at scoring time so toggling never falls
 * short of the display count.
 */
export interface RankedCards {
  default: SkeletonCard[];
  excludingFixing: SkeletonCard[];
}

export interface ClusterRecommendation {
  oracle: string;
  rating: number;
}

export interface ArchetypeSkeleton {
  clusterId: number;
  colorProfile: string; // e.g. "UR", "BGW", "C"
  poolCount: number;
  poolIndices: number[]; // indices into slimPools
  coreCards: RankedCards; // staples: most-drafted cards in this cluster, ranked by raw fraction
  distinctCards?: RankedCards; // legacy: kept so older locally cached runs still type-check
  identityCards?: RankedCards; // identity cards: appear in >5% of cluster decks, sorted by cosine(card_emb, centroid) desc
  signatureCards?: SkeletonCard[]; // legacy: kept so older locally cached runs still type-check
  occasionalCards: SkeletonCard[]; // deprecated; kept for older locally stored runs
  sideboardCards: SkeletonCard[]; // most common sideboard-only cards across decks in this cluster
  lockPairs: LockPair[]; // pairs co-occurring > 60% and well above independence baseline
  recommendedAdds?: ClusterRecommendation[]; // precomputed local recommender outputs for this cluster
}

/**
 * Response from POST /cube/api/simulate/setup/:id
 */
export interface SimulationSetupResponse {
  cubeId: string;
  // Initial pack contents per draft: [draftIndex][seatIndex][packIndex] = oracle IDs
  initialPacks: string[][][][];
  // Pack step sequence (same for all drafts, derived from format)
  packSteps: { action: string; amount?: number | null }[][];
  // Card metadata keyed by oracle_id — name, image, color, elo for display
  cardMeta: Record<string, CardMeta>;
  // Cube name for display
  cubeName: string;
  // Number of seats
  numSeats: number;
  // Cube's basic land options for client-side deckbuilding
  basics: BasicLandInfo[];
}
