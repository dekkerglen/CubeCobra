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
}

/**
 * Slim pool: persisted to S3 — pick sequence without redundant name/imageUrl fields
 * (those can be reconstructed from cardMeta at display time).
 */
export interface SlimPool {
  draftIndex: number;
  seatIndex: number;
  archetype: string;
  picks: { oracle_id: string; packNumber: number; pickNumber: number }[];
}

/**
 * One entry in the per-cube run history index.
 * ts is a Unix-ms timestamp and also the S3 key suffix for the full run.
 */
export interface SimulationRunEntry {
  ts: number;
  generatedAt: string;
  numDrafts: number;
  numSeats: number;
  deadCardCount: number;
  convergenceScore: number;
}

/**
 * Persisted to S3 per run — aggregate stats + slim pools + card metadata.
 */
export interface SimulationSummary {
  cubeId: string;
  cubeName: string;
  numDrafts: number;
  numSeats: number;
  deadCardThreshold: number; // 0.0 - 1.0
  cardStats: CardStats[];
  deadCards: CardStats[];
  colorBalance: ColorBalance;
  archetypeDistribution: ArchetypeEntry[];
  p1p1Frequency: P1P1Entry[]; // top 20
  convergenceScore: number; // stdev of pickRates
  generatedAt: string; // ISO timestamp
}

/**
 * Full run data stored at each S3 run key — extends SimulationSummary with
 * card metadata (for pool image reconstruction), slim pool pick sequences,
 * and pre-built deck builds for every pool.
 */
export interface SimulationRunData extends SimulationSummary {
  cardMeta: Record<string, CardMeta>;
  slimPools: SlimPool[];
  deckBuilds?: BuiltDeck[]; // one per slim pool, in order; absent on old runs
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
  coOccurrenceRate: number; // 0–1
}

export interface ArchetypeSkeleton {
  clusterId: number;
  colorProfile: string; // e.g. "UR", "BGW", "C"
  poolCount: number;
  poolIndices: number[]; // indices into slimPools
  coreCards: SkeletonCard[]; // fraction >= 0.4
  occasionalCards: SkeletonCard[]; // fraction 0.2–0.4
  lockPairs: LockPair[]; // pairs co-occurring > 85% and well above independence baseline
}

/**
 * Response from POST /cube/api/simulate/setup/:id
 */
export interface SimulationSetupResponse {
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
}
