export type Analytic = {
  decks: number;
  trophies: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
  // Per-card Elo derived from this cube's match results (per-card analytics only;
  // not set on pair buckets). Distinct from the global draft Elo on card details.
  matchElo?: number;
};

// Per-player aggregates across a cube's records — drives the trophy case.
export type PlayerAnalytic = {
  name: string;
  userId?: string;
  trophies: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  events: number;
};

export type RecordPlayerAnalytic = PlayerAnalytic[];

// keyed by oracle id
export type RecordAnalytic = {
  [key: string]: Analytic;
};

// Synergy: two cards appearing in the SAME deck. Keyed by `${oracleA}|${oracleB}`
// with oracleA < oracleB. Stats reflect the performance of decks containing both.
export type RecordPairAnalytic = {
  [pairKey: string]: Analytic;
};

// Matchup: one card's deck facing another card's deck across a match. Directed —
// keyed by `${oracle}|${opponentOracle}`, stats are from `oracle`'s perspective.
export type MatchupStat = {
  matches: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
};

export type RecordMatchupAnalytic = {
  [key: string]: MatchupStat;
};
