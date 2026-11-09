import RecordType, { Match, PlayerList, Round } from '@utils/datatypes/Record';

import { BYE, UNKNOWN_OPPONENT } from './pairings';

// Names a pairing uses for something other than a player. A player can't hold one: pairing
// would read them as a bye or an empty slot.
export const isReservedName = (name: string): boolean =>
  [BYE, UNKNOWN_OPPONENT].some((reserved) => reserved.toLowerCase() === name.trim().toLowerCase());

const isPlaceholder = (name: string) => name === BYE || name === UNKNOWN_OPPONENT;

// Pitting a player against themselves is never right, whatever else a round is in the middle of.
export const isSelfPairing = (match: Pick<Match, 'p1' | 'p2'>): boolean =>
  match.p1 === match.p2 && !isPlaceholder(match.p1);

// Players booked into more than one match of a round. Allowed while a round is being
// rearranged live (moving two players between matches passes through it), but flagged.
export const doubleBooked = (round: Round): string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const { p1, p2 } of round.matches) {
    for (const name of p1 === p2 ? [p1] : [p1, p2]) {
      if (isPlaceholder(name)) {
        continue;
      }
      if (seen.has(name)) {
        repeated.add(name);
      }
      seen.add(name);
    }
  }
  return [...repeated];
};

// Everything that makes a new round unfit to save: a player against themselves, a player in
// two matches, or a name that isn't in the event. Empty when the round holds together.
export const roundProblems = (round: Round, players: PlayerList): string[] => {
  const listed = new Set(players.map((player) => player.name));
  const problems: string[] = [];
  for (const match of round.matches) {
    if (isSelfPairing(match)) {
      problems.push(`${match.p1} is paired against themselves.`);
    }
  }
  for (const name of doubleBooked(round)) {
    problems.push(`${name} is in more than one match.`);
  }
  const strangers = new Set(
    round.matches.flatMap(({ p1, p2 }) => [p1, p2]).filter((name) => !isPlaceholder(name) && !listed.has(name)),
  );
  for (const name of strangers) {
    problems.push(`${name} isn't a player in this event.`);
  }
  return problems;
};

// Matches in a round nobody has reported a result for yet: all three counts still zero, between
// two real players.
export const unreportedMatches = (round: Round | undefined): Match[] =>
  (round?.matches ?? []).filter(
    ({ p1, p2, results }) => !isPlaceholder(p1) && !isPlaceholder(p2) && results.every((count) => count === 0),
  );

// Everyone who appears in a match of the record, under the name they hold now.
export const playersWithMatches = (record: Pick<RecordType, 'matches'>): Set<string> =>
  new Set(
    (record.matches ?? []).flatMap((round) =>
      round.matches.flatMap(({ p1, p2 }) => [p1, p2]).filter((name) => !isPlaceholder(name)),
    ),
  );

// How far a round has got: matches between two real players, and how many have a result.
// Byes need no reporting and empty placeholder matches can't be reported, so neither counts.
export const roundProgress = (round: Round | undefined): { reported: number; total: number } => {
  const playable = (round?.matches ?? []).filter(({ p1, p2 }) => !isPlaceholder(p1) && !isPlaceholder(p2));
  return {
    total: playable.length,
    reported: playable.filter(({ results }) => results.some((count) => count > 0)).length,
  };
};

// Table numbers for a round: each match between two real players gets the next number, in
// order; byes and empty placeholder matches don't take a table.
export const tableNumbers = (round: Round): (number | null)[] => {
  let next = 0;
  return round.matches.map(({ p1, p2 }) => (isPlaceholder(p1) || isPlaceholder(p2) ? null : (next += 1)));
};
