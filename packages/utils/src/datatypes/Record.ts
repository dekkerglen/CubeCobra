export type PlayerList = {
  name: string;
  userId?: string; // User ID is optional for users without an account
}[];

export interface Match {
  p1: string;
  p2: string;
  results: [number, number, number];
}
export interface Round {
  matches: Match[];
}

export interface WinLossDraw {
  wins: number;
  losses: number;
  draws: number;
}

export default interface Record {
  id: string;
  cube: string;
  date: number;
  name: string;
  description: string;
  players: PlayerList;
  matches: Round[]; // Array of rounds, each containing matches
  draft?: string; // Draft ID, if not present we haven't uploaded the decklist data yet
  trophy: string[];
  // Optional manual per-player win/loss/draw override (keyed by player name).
  // When set it wins over the match-derived total, so a record can be entered
  // without logging individual matches.
  overrides?: { [playerName: string]: WinLossDraw };
}

// A player's win/loss/draw: the manual override if present, otherwise derived
// from the match results (one win/loss/draw per match).
export function playerRecord(record: Record, playerName: string): WinLossDraw {
  const override = record.overrides?.[playerName];
  if (override) {
    return override;
  }
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const round of record.matches || []) {
    for (const match of round.matches) {
      const isP1 = match.p1 === playerName;
      const isP2 = match.p2 === playerName;
      if (!isP1 && !isP2) {
        continue;
      }
      const mine = isP1 ? match.results[0] : match.results[1];
      const theirs = isP1 ? match.results[1] : match.results[0];
      if (mine > theirs) {
        wins += 1;
      } else if (mine < theirs) {
        losses += 1;
      } else {
        draws += 1;
      }
    }
  }
  return { wins, losses, draws };
}

export const formatRecord = ({ wins, losses, draws }: WinLossDraw): string =>
  draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
