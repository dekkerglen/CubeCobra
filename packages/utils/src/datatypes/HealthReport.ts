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
  percentage: number; // count / (numDrafts * numSeats)
}

export interface HealthReport {
  cubeId: string;
  cubeName: string;
  numDrafts: number;
  numSeats: number;
  deadCardThreshold: number; // 0.0 - 1.0
  cardStats: CardStats[];
  deadCards: CardStats[]; // cards with pickRate < deadCardThreshold
  colorBalance: ColorBalance;
  archetypeDistribution: ArchetypeEntry[];
  p1p1Frequency: P1P1Entry[]; // top 20
  convergenceScore: number; // stdev of pickRates — low = "solved" format, high = diverse
  generatedAt: string; // ISO timestamp
}

export interface SimulationProgress {
  currentDraft: number;
  totalDrafts: number;
  percentage: number;
}

export interface SimulationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: SimulationProgress | null;
  result: HealthReport | null;
  error: string | null;
  createdAt: number;
  cubeId: string;
}
