import { cardOracleId, detailsToCard } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record, { PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';

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

// Builds the editor's starting state. Everything is copied out of the record, so the
// seeded baseline isDirty compares against cannot be moved by editing the live state.
export const seedTranscribeState = (record: Record, draft?: Draft): TranscribeState => {
  const editable = draft === undefined || draft.type === DRAFT_TYPES.UPLOAD;
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
