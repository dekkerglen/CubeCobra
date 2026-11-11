import { Match, PlayerList } from '@utils/datatypes/Record';
import { BYE, generatePairings } from '@utils/records/pairings';

export type SeatedPlayer = PlayerList[number];

// One chair at the table. `origin` is the index the player held in the record's list when the
// table was opened, or -1 for someone seated since: the players endpoint moves each player's
// deck and draft seat by it, so it has to follow the player, not the chair.
export interface Seat {
  player?: SeatedPlayer;
  origin: number;
}

export const MIN_SEATS = 2;
export const MAX_SEATS = 16;
export const DEFAULT_SEATS = 8;

const emptySeat = (): Seat => ({ origin: -1 });
const clampSeats = (count: number) => Math.max(MIN_SEATS, Math.min(MAX_SEATS, count));

export const occupied = (seats: Seat[]): number => seats.filter((seat) => seat.player).length;

// The record's players around a table with room for an eight-player pod, or exactly as many
// chairs as there are players once the pod is bigger.
export const seatsFromPlayers = (players: PlayerList): Seat[] => {
  const seats: Seat[] = players.map((player, index) => ({ player, origin: index }));
  while (seats.length < DEFAULT_SEATS) {
    seats.push(emptySeat());
  }
  return seats;
};

export const setSeat = (seats: Seat[], index: number, player: SeatedPlayer | undefined): Seat[] =>
  seats.map((seat, position) => {
    if (position !== index) {
      return seat;
    }
    if (!player) {
      return emptySeat();
    }
    if (!seat.player) {
      return { player, origin: -1 };
    }
    return { origin: seat.origin, player: { ...(seat.player.id ? { id: seat.player.id } : {}), ...player } };
  });

export const swapSeats = (seats: Seat[], a: number, b: number): Seat[] => {
  if (a === b) {
    return seats;
  }
  const next = [...seats];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
};

// Adds or takes away chairs. Empty chairs go first, from the end of the table back, so
// shrinking never unseats anyone; the table cannot shrink below the players sitting at it.
export const resizeTable = (seats: Seat[], count: number): Seat[] => {
  const target = Math.max(clampSeats(count), occupied(seats));
  const next = [...seats];
  while (next.length < target) {
    next.push(emptySeat());
  }
  for (let index = next.length - 1; next.length > target && index >= 0; index--) {
    if (!next[index]!.player) {
      next.splice(index, 1);
    }
  }
  return next;
};

const shuffled = <T>(items: T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
};

// Everyone at the table in a random order, filling from seat one so the empty chairs end up
// together at the end.
export const shuffleSeats = (seats: Seat[], random: () => number = Math.random): Seat[] => {
  const sitting = shuffled(
    seats.filter((seat) => seat.player),
    random,
  );
  return seats.map((_, index) => sitting[index] ?? emptySeat());
};

// One name per line, or separated by commas. Blank entries are skipped, and a repeat of a
// name already listed (ignoring case and a leading @) is reported rather than seated twice.
export const parsePlayerList = (text: string): { names: string[]; duplicates: string[] } => {
  const names: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,]/)) {
    const name = raw.trim();
    if (!name) {
      continue;
    }
    const key = name.replace(/^@/, '').trim().toLowerCase();
    if (seen.has(key)) {
      duplicates.push(name);
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { names, duplicates };
};

// Seats a list of players, in the order given or at random, at a table with one chair each.
// A player already at the table (matched by name) keeps their origin, so seating a list that
// repeats the existing roster moves those players rather than replacing them.
export const seatPlayers = (
  players: SeatedPlayer[],
  current: Seat[],
  order: 'listed' | 'random',
  random: () => number = Math.random,
): Seat[] => {
  const originByName = new Map<string, Seat>();
  for (const seat of current) {
    if (seat.player) {
      originByName.set(seat.player.name.toLowerCase(), seat);
    }
  }
  const seated = players.slice(0, MAX_SEATS).map((player): Seat => {
    const existing = originByName.get(player.name.toLowerCase());
    if (!existing) {
      return { player, origin: -1 };
    }
    // A plain name in the list keeps the account the seated player was already linked to.
    return { player: { ...existing.player!, ...player }, origin: existing.origin };
  });
  const ordered = order === 'random' ? shuffled(seated, random) : seated;
  return resizeTable(ordered, Math.max(ordered.length, MIN_SEATS));
};

// What the players endpoint takes: the players in seat order with the empty chairs closed up,
// and for each the index it came from.
export const tableSubmission = (seats: Seat[]): { players: PlayerList; seatOrder: number[] } => {
  const sitting = seats.filter((seat) => seat.player);
  return {
    players: sitting.map((seat) => seat.player!),
    seatOrder: sitting.map((seat) => seat.origin),
  };
};

export const nameTaken = (seats: Seat[], name: string, exceptIndex: number): boolean =>
  seats.some(
    (seat, index) => index !== exceptIndex && seat.player && seat.player.name.toLowerCase() === name.toLowerCase(),
  );

// A repeatable random sequence (mulberry32), so a random draw stays the same draw while chairs
// are filled around it and only changes when the organiser asks for another.
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Round one for the players at the table, from the same pairings Add Round makes: across the
// table with the empty chairs closed up, or drawn at random from `seed`. An odd count leaves
// one player a bye.
export const roundOnePairings = (seats: Seat[], method: 'across' | 'random', seed = 0): Match[] =>
  generatePairings(tableSubmission(seats).players, [], [], { method, random: seededRandom(seed) });

// Who the player in a chair meets in `pairings`: the index of their opponent's chair, 'bye', or
// null for an empty chair or a player left unpaired.
export const roundOneOpponent = (seats: Seat[], index: number, pairings: Match[]): number | 'bye' | null => {
  const name = seats[index]?.player?.name;
  if (!name) {
    return null;
  }
  const match = pairings.find((candidate) => candidate.p1 === name || candidate.p2 === name);
  if (!match) {
    return null;
  }
  const opponent = match.p1 === name ? match.p2 : match.p1;
  return opponent === BYE ? 'bye' : seats.findIndex((seat) => seat.player?.name === opponent);
};
