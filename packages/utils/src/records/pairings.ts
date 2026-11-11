import { Match, PlayerList, Round } from '@utils/datatypes/Record';

// The placeholder a match starts with before anyone is seated in it. Not a player: it never
// earns points, and two matches against it are not a rematch.
export const UNKNOWN_OPPONENT = 'Unknown Opponent';

// The opponent of a player who sits a round out. Stored as an ordinary match so that
// playerRecord counts it as the win a bye is, with no special-casing anywhere that reads
// records.
export const BYE = 'Bye';

// A bye is scored as a 2-0 match win, the way most Swiss events score one.
const BYE_RESULTS: [number, number, number] = [2, 0, 0];

const MATCH_WIN_POINTS = 3;
const MATCH_DRAW_POINTS = 1;

const pairingKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

const unplayed = (p1: string, p2: string): Match => ({ p1, p2, results: [0, 0, 0] });
const bye = (player: string): Match => ({ p1: player, p2: BYE, results: [...BYE_RESULTS] });

interface History {
  points: Map<string, number>;
  hadBye: Set<string>;
  played: Set<string>;
}

// What the earlier rounds say about each listed player. A match nobody has reported yet
// (all three counts still zero) scores nothing, but its pairing still counts as played, so
// adding a round before the last one is fully reported can't pair the same two players again.
const readHistory = (names: string[], rounds: Round[]): History => {
  const listed = new Set(names);
  const points = new Map(names.map((name) => [name, 0]));
  const hadBye = new Set<string>();
  const played = new Set<string>();

  const award = (name: string, amount: number) => {
    if (listed.has(name)) {
      points.set(name, (points.get(name) ?? 0) + amount);
    }
  };

  for (const round of rounds) {
    for (const { p1, p2, results } of round.matches) {
      if (p1 === BYE || p2 === BYE) {
        const player = p1 === BYE ? p2 : p1;
        hadBye.add(player);
        award(player, MATCH_WIN_POINTS);
        continue;
      }
      if (p1 === UNKNOWN_OPPONENT || p2 === UNKNOWN_OPPONENT) {
        continue;
      }
      played.add(pairingKey(p1, p2));
      const [p1Wins, p2Wins, draws] = results;
      if (p1Wins + p2Wins + draws === 0) {
        continue;
      }
      if (p1Wins > p2Wins) {
        award(p1, MATCH_WIN_POINTS);
      } else if (p2Wins > p1Wins) {
        award(p2, MATCH_WIN_POINTS);
      } else {
        award(p1, MATCH_DRAW_POINTS);
        award(p2, MATCH_DRAW_POINTS);
      }
    }
  }

  return { points, hadBye, played };
};

// Pairs `players` in order, each with the highest-placed player it hasn't met yet, backing up
// when that leaves someone further down with only rematches. Null when no rematch-free pairing
// exists. Pods top out at 16 players, which keeps the search small.
const pairWithoutRematches = (players: string[], played: Set<string>): [string, string][] | null => {
  if (players.length === 0) {
    return [];
  }
  const [first, ...rest] = players;
  for (let index = 0; index < rest.length; index++) {
    const opponent = rest[index]!;
    if (played.has(pairingKey(first!, opponent))) {
      continue;
    }
    const remaining = [...rest.slice(0, index), ...rest.slice(index + 1)];
    const paired = pairWithoutRematches(remaining, played);
    if (paired) {
      return [[first!, opponent], ...paired];
    }
  }
  return null;
};

// Round one: each player meets the one seated across the table (seat 1 against seat 5 in a pod
// of eight), the usual way a cube pod is paired after the draft. With an odd count, the player
// in the middle seat, who would have faced nobody, gets the bye.
const pairAcrossTheTable = (names: string[]): Match[] => {
  const half = Math.ceil(names.length / 2);
  const matches: Match[] = [];
  for (let seat = 0; seat < Math.floor(names.length / 2); seat++) {
    matches.push(unplayed(names[seat]!, names[seat + half]!));
  }
  if (names.length % 2 === 1) {
    matches.push(bye(names[half - 1]!));
  }
  return matches;
};

// Pairings drawn at random, ignoring the standings: the players are shuffled and paired off in
// that order. Later rounds still avoid a rematch where one can be avoided, and the bye goes to
// someone who hasn't had one.
const pairAtRandom = (names: string[], history: History, random: () => number): Match[] => {
  const order = [...names];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other]!, order[index]!];
  }

  let byePlayer: string | undefined;
  if (order.length % 2 === 1) {
    byePlayer = order.find((name) => !history.hadBye.has(name)) ?? order[0];
    order.splice(order.indexOf(byePlayer!), 1);
  }

  const pairs =
    pairWithoutRematches(order, history.played) ??
    Array.from({ length: order.length / 2 }, (_, index): [string, string] => [
      order[index * 2]!,
      order[index * 2 + 1]!,
    ]);
  const matches = pairs.map(([p1, p2]) => unplayed(p1, p2));
  if (byePlayer) {
    matches.push(bye(byePlayer));
  }
  return matches;
};

// Later rounds are Swiss: players are ranked by match points, ties broken by seat, and paired
// down the standings without repeating a pairing where possible. With an odd count, the bye
// goes to the lowest-ranked player who hasn't had one yet.
const pairBySwiss = (names: string[], history: History): Match[] => {
  const seat = new Map(names.map((name, index) => [name, index]));
  const standings = [...names].sort(
    (a, b) => (history.points.get(b) ?? 0) - (history.points.get(a) ?? 0) || seat.get(a)! - seat.get(b)!,
  );

  let byePlayer: string | undefined;
  if (standings.length % 2 === 1) {
    byePlayer = [...standings].reverse().find((name) => !history.hadBye.has(name)) ?? standings.at(-1);
    standings.splice(standings.indexOf(byePlayer!), 1);
  }

  // Every pairing has already happened (a long event in a small pod): fall back to pairing
  // straight down the standings, rematches and all, rather than producing no round at all.
  const pairs =
    pairWithoutRematches(standings, history.played) ??
    Array.from({ length: standings.length / 2 }, (_, index): [string, string] => [
      standings[index * 2]!,
      standings[index * 2 + 1]!,
    ]);

  const matches = pairs.map(([p1, p2]) => unplayed(p1, p2));
  if (byePlayer) {
    matches.push(bye(byePlayer));
  }
  return matches;
};

// How a round is paired: across the table from the seating (the usual first round), by record
// (Swiss, the usual later round), or drawn at random.
export type PairingMethod = 'across' | 'record' | 'random';

export interface PairingOptions {
  // Defaults to across the table for the first round and by record after that.
  method?: PairingMethod;
  random?: () => number;
}

/**
 * Suggested pairings for the next round of `rounds`, for the organiser to adjust before it is
 * saved. Players are taken in `players` order, which is the order they sat at the draft table;
 * anyone in `dropped` has left the event and is not paired.
 */
export const generatePairings = (
  players: PlayerList,
  rounds: Round[],
  dropped: string[] = [],
  { method, random = Math.random }: PairingOptions = {},
): Match[] => {
  const left = new Set(dropped);
  const names = [...new Set(players.map((player) => player.name))].filter(
    (name) => name && name !== BYE && name !== UNKNOWN_OPPONENT && !left.has(name),
  );
  if (names.length < 2) {
    return [];
  }
  const anyPaired = rounds.some((round) => round.matches.length > 0);
  const chosen = method ?? (anyPaired ? 'record' : 'across');
  const history = readHistory(names, rounds);
  if (chosen === 'random') {
    return pairAtRandom(names, history, random);
  }
  return chosen === 'record' ? pairBySwiss(names, history) : pairAcrossTheTable(names);
};
