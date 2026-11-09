import Record, { playerRecord, WinLossDraw } from '@utils/datatypes/Record';
import { BYE, UNKNOWN_OPPONENT } from '@utils/records/pairings';

// A percentage tiebreaker never counts below a third, so losing to a player who had a bad day
// doesn't sink a strong record. The usual Swiss rule.
const PERCENTAGE_FLOOR = 1 / 3;

const MATCH_WIN_POINTS = 3;
const MATCH_DRAW_POINTS = 1;
const GAME_WIN_POINTS = 3;
const GAME_DRAW_POINTS = 1;

// A bye is played as a 2-0 win: it counts toward the player's own match and game percentages,
// but no opponent stands behind it, so it never enters anyone's opponent percentages.
const BYE_GAMES = { won: 2, lost: 0, drawn: 0 };

export interface Standing extends WinLossDraw {
  name: string;
  userId?: string;
  rank: number;
  points: number;
  // The tiebreakers, as fractions. Absent for a player with nothing to compute them from: no
  // reported matches, or a record entered as a manual override.
  opponentMatchWin?: number;
  gameWin?: number;
  opponentGameWin?: number;
  dropped: boolean;
}

interface Tally extends WinLossDraw {
  matchPoints: number;
  matchesPlayed: number;
  gamePoints: number;
  gamesPlayed: number;
  opponents: string[];
}

const percentage = (points: number, played: number, perPlay: number): number | undefined =>
  played > 0 ? Math.max(PERCENTAGE_FLOOR, points / (played * perPlay)) : undefined;

const average = (values: (number | undefined)[]): number | undefined => {
  const known = values.filter((value): value is number => value !== undefined);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) / known.length : undefined;
};

// Each listed player's reported matches. A match nobody has reported yet (all three counts
// still zero) has not been played as far as standings go, and the placeholder opponent is
// nobody.
const tallyMatches = (record: Record, names: Set<string>): Map<string, Tally> => {
  const tallies = new Map<string, Tally>();
  const tally = (name: string): Tally => {
    let entry = tallies.get(name);
    if (!entry) {
      entry = {
        wins: 0,
        losses: 0,
        draws: 0,
        matchPoints: 0,
        matchesPlayed: 0,
        gamePoints: 0,
        gamesPlayed: 0,
        opponents: [],
      };
      tallies.set(name, entry);
    }
    return entry;
  };
  const score = (name: string, won: number, lost: number, drawn: number, opponent?: string) => {
    if (!names.has(name)) {
      return;
    }
    const entry = tally(name);
    entry.matchesPlayed += 1;
    if (won > lost) {
      entry.wins += 1;
      entry.matchPoints += MATCH_WIN_POINTS;
    } else if (won < lost) {
      entry.losses += 1;
    } else {
      entry.draws += 1;
      entry.matchPoints += MATCH_DRAW_POINTS;
    }
    entry.gamesPlayed += won + lost + drawn;
    entry.gamePoints += won * GAME_WIN_POINTS + drawn * GAME_DRAW_POINTS;
    if (opponent && names.has(opponent)) {
      entry.opponents.push(opponent);
    }
  };

  for (const round of record.matches || []) {
    for (const { p1, p2, results } of round.matches) {
      if (p1 === BYE || p2 === BYE) {
        score(p1 === BYE ? p2 : p1, BYE_GAMES.won, BYE_GAMES.lost, BYE_GAMES.drawn);
        continue;
      }
      if (p1 === UNKNOWN_OPPONENT || p2 === UNKNOWN_OPPONENT) {
        continue;
      }
      const [p1Wins, p2Wins, draws] = results;
      if (p1Wins + p2Wins + draws === 0) {
        continue;
      }
      score(p1, p1Wins, p2Wins, draws, p2);
      score(p2, p2Wins, p1Wins, draws, p1);
    }
  }
  return tallies;
};

/**
 * The record's players ranked by match points, then opponents' match-win percentage, game-win
 * percentage and opponents' game-win percentage, and finally by seat. A player whose record is
 * a manual override is ranked by the points that override implies, with no tiebreakers.
 * Matches not yet reported (still 0-0-0) count for nothing.
 */
export const computeStandings = (record: Record): Standing[] => {
  const names = new Set(record.players.map((player) => player.name));
  const dropped = new Set(record.dropped ?? []);
  const tallies = tallyMatches(record, names);

  const matchWin = new Map<string, number | undefined>();
  const gameWin = new Map<string, number | undefined>();
  for (const [name, entry] of tallies) {
    matchWin.set(name, percentage(entry.matchPoints, entry.matchesPlayed, MATCH_WIN_POINTS));
    gameWin.set(name, percentage(entry.gamePoints, entry.gamesPlayed, GAME_WIN_POINTS));
  }

  const seen = new Set<string>();
  const unranked = record.players
    .filter((player) => {
      // Two entries under one name are one player as far as everything keyed by name goes.
      if (seen.has(player.name)) {
        return false;
      }
      seen.add(player.name);
      return true;
    })
    .map((player, seat) => {
      const overridden = Boolean(record.overrides?.[player.name]);
      const entry = tallies.get(player.name);
      // Counted from reported matches rather than playerRecord, which reads a round paired a
      // moment ago (every match still 0-0-0) as a draw for everyone in it.
      const result: WinLossDraw = overridden
        ? playerRecord(record, player.name)
        : { wins: entry?.wins ?? 0, losses: entry?.losses ?? 0, draws: entry?.draws ?? 0 };
      const tiebreakers =
        overridden || !entry
          ? {}
          : {
              opponentMatchWin: average(entry.opponents.map((opponent) => matchWin.get(opponent))),
              gameWin: gameWin.get(player.name),
              opponentGameWin: average(entry.opponents.map((opponent) => gameWin.get(opponent))),
            };
      return {
        seat,
        standing: {
          name: player.name,
          ...(player.userId ? { userId: player.userId } : {}),
          ...result,
          // Derived from the W-L-D rather than the tally so an override counts too.
          points: result.wins * MATCH_WIN_POINTS + result.draws * MATCH_DRAW_POINTS,
          ...tiebreakers,
          dropped: dropped.has(player.name),
          rank: 0,
        } as Standing,
      };
    });

  const tiebreak = (value?: number) => value ?? 0;
  unranked.sort(
    (a, b) =>
      b.standing.points - a.standing.points ||
      tiebreak(b.standing.opponentMatchWin) - tiebreak(a.standing.opponentMatchWin) ||
      tiebreak(b.standing.gameWin) - tiebreak(a.standing.gameWin) ||
      tiebreak(b.standing.opponentGameWin) - tiebreak(a.standing.opponentGameWin) ||
      a.seat - b.seat,
  );
  return unranked.map(({ standing }, index) => ({ ...standing, rank: index + 1 }));
};

export const formatPercentage = (value?: number): string =>
  value === undefined ? '—' : `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
