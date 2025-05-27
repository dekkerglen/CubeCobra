export type Analytic = {
  decks: number;
  trophies: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
};

// keyed by oracle id
export type RecordAnalytic = {
  [key: string]: Analytic;
};
