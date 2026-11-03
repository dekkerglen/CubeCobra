import { cardOracleId, detailsToCard } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record, { applyPlayerRenames, PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';

// The limits POST /cube/records/enter/:id enforces, in one place: the page validates against
// them, the results editor refuses to add past them, and the server's Joi schema mirrors them.
// Every one is a 400 the user would otherwise only see after typing out a whole event.
export const MAX_PLAYERS = 16;
export const MAX_DECK_CARDS = 200;
export const MAX_ROUNDS = 50;

export type DeckBoard = 'mainboard' | 'sideboard';

// React's SetStateAction without the React import — this module stays pure.
export type CardsUpdate = CardDetails[] | ((previous: CardDetails[]) => CardDetails[]);

export interface TranscribeDeck {
  mainboard: CardDetails[];
  sideboard: CardDetails[];
  // Set by the editor when the user changes this seat's cards. Only dirty seats are
  // submitted: re-writing an unchanged seat appends freshly resolved cards to draft.cards
  // and orphans the old indices, growing the draft on every save.
  dirty: boolean;
  // False for a record backed by a real played draft, whose seat pools are tied to its
  // pick and trash orders and pack history.
  editable: boolean;
}

export interface TranscribeState {
  name: string;
  date: number;
  description: string;
  players: PlayerList;
  // seatOrder[i] is the draft seat the player now at position i came from, or -1 for a
  // player added since the record was loaded. One entry per player.
  seatOrder: number[];
  trophy: string[];
  // A name mapped to undefined is "no override" — the same as absent — because the editor
  // clears an override in place rather than deleting the key.
  overrides: { [playerName: string]: WinLossDraw | undefined };
  matches: Round[];
  // 0-based and parallel to players. The payload re-keys these 1-based for the server.
  decks: { [playerIndex: number]: TranscribeDeck };
}

// Exactly the body POST /cube/records/enter/:id validates.
export interface TranscribePayload {
  name: string;
  date: number;
  description: string;
  players: PlayerList;
  seatOrder: number[];
  matches: Round[];
  overrides: { [playerName: string]: WinLossDraw };
  trophy: string[];
  decks: { [userIndex: number]: { mainboard: string[]; sideboard: string[] } };
}

const flattenSeatPool = (pool: number[][][] | undefined, cards: Card[]): CardDetails[] =>
  (pool ?? [])
    .flat(3)
    .map((cardIndex) => cards[cardIndex]?.details)
    .filter((details): details is CardDetails => !!details);

const copyMatches = (matches: Round[]): Round[] =>
  matches.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match, results: [...match.results] as [number, number, number] })),
  }));

// Whether this page owns the seat pools. A record backed by a real played draft does not:
// its seats are tied to the draft's pick and trash orders and pack history.
export const areSeatsEditable = (draft?: Draft): boolean => draft === undefined || draft.type === DRAFT_TYPES.UPLOAD;

// Builds the editor's starting state. Everything is copied out of the record, so the
// seeded baseline isDirty compares against cannot be moved by editing the live state.
export const seedTranscribeState = (record: Record, draft?: Draft): TranscribeState => {
  const editable = areSeatsEditable(draft);
  const decks: { [playerIndex: number]: TranscribeDeck } = {};

  record.players.forEach((_, index) => {
    const seat = draft?.seats[index];
    decks[index] = {
      mainboard: flattenSeatPool(seat?.mainboard, draft?.cards ?? []),
      sideboard: flattenSeatPool(seat?.sideboard, draft?.cards ?? []),
      dirty: false,
      editable,
    };
  });

  return {
    name: record.name,
    date: record.date,
    description: record.description,
    players: record.players.map((player) => ({ ...player })),
    seatOrder: record.players.map((_, index) => index),
    trophy: [...(record.trophy ?? [])],
    overrides: { ...(record.overrides ?? {}) },
    matches: copyMatches(record.matches ?? []),
    decks,
  };
};

const toOracleIds = (details: CardDetails[]): string[] => details.map(detailsToCard).map(cardOracleId);

// Deck edits are refused for a seat this record does not own. One stray dirty flag on a
// played draft's seat makes the server reject the entire save — overview and pairings
// included — so the guard lives here rather than only in what gets rendered.
export const setDeckCards = (
  state: TranscribeState,
  playerIndex: number,
  board: DeckBoard,
  update: CardsUpdate,
): TranscribeState => {
  const deck = state.decks[playerIndex];
  if (!deck || !deck.editable) {
    return state;
  }
  const cards = typeof update === 'function' ? update(deck[board]) : update;
  return {
    ...state,
    decks: { ...state.decks, [playerIndex]: { ...deck, [board]: cards, dirty: true } },
  };
};

// Applies an edited player list, plus the seat each entry came from in the list the editor
// was opened on (-1 for a player added since). Everything keyed by player — standings,
// trophies, pairings — is re-keyed from that mapping: the endpoint drops any key that is not
// a submitted player name, so a rename that stopped at the player list would quietly throw
// that player's results away.
export const applyPlayerEdit = (
  state: TranscribeState,
  edited: PlayerList,
  originSeats: number[],
  seatsEditable: boolean,
): TranscribeState => {
  const renames = new Map<string, string>();
  edited.forEach((player, index) => {
    const origin = originSeats[index] ?? -1;
    const before = origin >= 0 ? state.players[origin]?.name : undefined;
    if (before && before !== player.name) {
      renames.set(before, player.name);
    }
  });

  // applyPlayerRenames takes the whole mapping at once, so a straight swap of two names
  // resolves against the originals instead of chaining through itself.
  const renamed = {
    matches: state.matches,
    trophy: state.trophy,
    overrides: { ...state.overrides },
  } as Record;
  applyPlayerRenames(renamed, renames);

  const names = new Set(edited.map((player) => player.name));
  const overrides: TranscribeState['overrides'] = {};
  for (const [name, value] of Object.entries(renamed.overrides ?? {})) {
    if (names.has(name)) {
      overrides[name] = value;
    }
  }

  const decks: { [playerIndex: number]: TranscribeDeck } = {};
  edited.forEach((_, index) => {
    const origin = originSeats[index] ?? -1;
    decks[index] = (origin >= 0 ? state.decks[origin] : undefined) ?? {
      mainboard: [],
      sideboard: [],
      dirty: false,
      editable: seatsEditable,
    };
  });

  return {
    ...state,
    players: edited,
    // originSeats indexes the list as it stood; seatOrder has to keep pointing at the draft
    // seats the record was loaded with.
    seatOrder: originSeats.map((origin) => (origin >= 0 ? (state.seatOrder[origin] ?? -1) : -1)),
    matches: renamed.matches,
    trophy: (renamed.trophy ?? []).filter((name) => names.has(name)),
    overrides,
    decks,
  };
};

// Everything the endpoint's Joi schema would reject, phrased for the person typing. Save is
// held back until this is empty, so a whole transcribed event is never traded for a 400.
export const validationErrors = (state: TranscribeState): string[] => {
  const errors: string[] = [];

  if (!state.name.trim()) {
    errors.push('Give this record a name.');
  }
  if (!Number.isFinite(state.date)) {
    errors.push('Give this record a date.');
  }
  if (state.players.length > MAX_PLAYERS) {
    errors.push(`A record holds at most ${MAX_PLAYERS} players, and this one has ${state.players.length}.`);
  }

  // Checked case-insensitively, a superset of Joi's exact .unique('name'): two players whose
  // names differ only in case are indistinguishable everywhere results are keyed by name.
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const player of state.players) {
    const key = player.name.toLowerCase();
    if (seen.has(key)) {
      duplicates.add(player.name);
    }
    seen.add(key);
  }
  if (duplicates.size > 0) {
    errors.push(`Two players cannot share a name: ${[...duplicates].join(', ')}.`);
  }

  if (state.matches.length > MAX_ROUNDS) {
    errors.push(`A record holds at most ${MAX_ROUNDS} rounds, and this one has ${state.matches.length}.`);
  }

  // Only an edited deck is submitted, so only an edited deck can be rejected for its size.
  for (const [key, deck] of Object.entries(state.decks)) {
    if (!deck.dirty) {
      continue;
    }
    const name = state.players[Number(key)]?.name ?? `Seat ${Number(key) + 1}`;
    if (deck.mainboard.length > MAX_DECK_CARDS) {
      errors.push(`${name}'s mainboard has ${deck.mainboard.length} cards, over the ${MAX_DECK_CARDS} limit.`);
    }
    if (deck.sideboard.length > MAX_DECK_CARDS) {
      errors.push(`${name}'s sideboard has ${deck.sideboard.length} cards, over the ${MAX_DECK_CARDS} limit.`);
    }
  }

  return errors;
};

export const toTranscribePayload = (state: TranscribeState): TranscribePayload => {
  const decks: TranscribePayload['decks'] = {};
  for (const [playerIndex, deck] of Object.entries(state.decks)) {
    if (!deck.dirty) {
      continue;
    }
    // A dirty deck with an empty mainboard is still submitted: that is the user deleting
    // every card, and the server resets the seat.
    decks[Number(playerIndex) + 1] = {
      mainboard: toOracleIds(deck.mainboard),
      sideboard: toOracleIds(deck.sideboard),
    };
  }

  const overrides: { [playerName: string]: WinLossDraw } = {};
  for (const [name, value] of Object.entries(state.overrides)) {
    // A `0-0-0` posted for an untouched player would mask every pairing-derived standing,
    // because playerRecord prefers any present override.
    if (value) {
      overrides[name] = value;
    }
  }

  return {
    name: state.name,
    date: state.date,
    description: state.description,
    players: state.players,
    seatOrder: state.seatOrder,
    matches: state.matches,
    overrides,
    trophy: state.trophy,
    decks,
  };
};

const sameList = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const samePlayers = (a: PlayerList, b: PlayerList): boolean =>
  a.length === b.length &&
  a.every((player, index) => player.name === b[index]?.name && player.userId === b[index]?.userId);

const sameMatches = (a: Round[], b: Round[]): boolean =>
  a.length === b.length &&
  a.every((round, roundIndex) => {
    const other = b[roundIndex]?.matches ?? [];
    return (
      round.matches.length === other.length &&
      round.matches.every(
        (match, matchIndex) =>
          match.p1 === other[matchIndex]?.p1 &&
          match.p2 === other[matchIndex]?.p2 &&
          sameList(match.results, other[matchIndex]?.results ?? []),
      )
    );
  });

const sameOverrides = (
  a: { [playerName: string]: WinLossDraw | undefined },
  b: { [playerName: string]: WinLossDraw | undefined },
): boolean =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].every((name) => {
    const mine = a[name];
    const theirs = b[name];
    if (!mine || !theirs) {
      return !mine && !theirs;
    }
    return mine.wins === theirs.wins && mine.losses === theirs.losses && mine.draws === theirs.draws;
  });

// Whether the editor holds anything worth saving. Deck edits are answered by the seats'
// own dirty flags rather than by comparing card lists.
export const isDirty = (state: TranscribeState, seeded: TranscribeState): boolean => {
  if (Object.values(state.decks).some((deck) => deck.dirty)) {
    return true;
  }

  return !(
    state.name === seeded.name &&
    state.date === seeded.date &&
    state.description === seeded.description &&
    samePlayers(state.players, seeded.players) &&
    sameList(state.seatOrder, seeded.seatOrder) &&
    sameList(state.trophy, seeded.trophy) &&
    sameOverrides(state.overrides, seeded.overrides) &&
    sameMatches(state.matches, seeded.matches)
  );
};
