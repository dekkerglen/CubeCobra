import { CardDetails } from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record, { applyPlayerRenames, PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';
import { flattenSeatPool, SectionBaselines, SectionKey, toOracleIds } from '@utils/records/recordSections';

// The limits POST /cube/records/enter/:id enforces, in one place: the page validates against
// them, the results editor refuses to add past them, and the server's Joi schema mirrors them.
// Every one is a 400 the user would otherwise only see after typing out a whole event.
export const MAX_PLAYERS = 16;
export const MAX_DECK_CARDS = 200;
export const MAX_ROUNDS = 50;
export const MAX_NAME_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 1000;

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

// A paste the user is still working through: the text in the box, and the lines from the
// last attempt that could not be resolved. It is the user's typing rather than part of the
// record, so it is deliberately not in TranscribeState — it is neither submitted nor counted
// as an unsaved change.
export interface TranscribePaste {
  text: string;
  errors: string[];
}

// Carries each pending paste to wherever its player ended up, the same way applyPlayerEdit
// carries the decks. Without this a half-typed decklist would stay at its old position and
// end up sitting under a different player's name.
export const movePastes = (
  pastes: { [playerIndex: number]: TranscribePaste },
  originSeats: number[],
): { [playerIndex: number]: TranscribePaste } => {
  const next: { [playerIndex: number]: TranscribePaste } = {};
  originSeats.forEach((origin, index) => {
    const carried = origin >= 0 ? pastes[origin] : undefined;
    if (carried) {
      next[index] = carried;
    }
  });
  return next;
};

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
  // 0-based and parallel to players. A dirty deck's section key is the player's id, or this
  // index itself for a player with none.
  decks: { [playerIndex: number]: TranscribeDeck };
}

// What a single dirty section carries in the new payload: either one of the whole-record
// shapes from SectionBaselines, a per-player override (null clears it), or a per-player deck.
type TranscribeSectionValue =
  | NonNullable<SectionBaselines['overview']>
  | NonNullable<SectionBaselines['players']>
  | NonNullable<SectionBaselines['rounds']>
  | NonNullable<SectionBaselines['trophy']>
  | WinLossDraw
  | null
  | { mainboard: string[]; sideboard: string[] };

// Exactly the body POST /cube/records/enter/:id now accepts: only the sections that changed,
// each carrying the baseline this workspace loaded so the server can tell "I changed this"
// from "someone else did while I had the record open".
export interface TranscribeSectionsPayload {
  sections: { [K in SectionKey]?: TranscribeSectionValue };
  baselines: SectionBaselines;
}

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
  if (state.name.length > MAX_NAME_LENGTH) {
    errors.push(`A record name is at most ${MAX_NAME_LENGTH} characters, and this one has ${state.name.length}.`);
  }
  if (!Number.isFinite(state.date)) {
    errors.push('Give this record a date.');
  }
  // The file importer accepts descriptions up to 5000 characters, so a record can arrive
  // already past this endpoint's cap — which would otherwise only surface as a raw Joi
  // message after the whole event had been typed out.
  if (state.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `A record description is at most ${MAX_DESCRIPTION_LENGTH} characters, and this one has ${state.description.length}.`,
    );
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

// One player's override, the same equality `sameOverrides` used to apply across a whole map:
// falsy either side is "no override", and two falsy values are equal regardless of which kind
// of falsy they are. Overrides are now diffed per player rather than as one block, since each
// one is its own section, so this compares a single pair rather than a whole map.
const sameOverride = (a: WinLossDraw | null | undefined, b: WinLossDraw | null | undefined): boolean => {
  if (!a || !b) {
    return !a === !b;
  }
  return a.wins === b.wins && a.losses === b.losses && a.draws === b.draws;
};

// What a player's override section would hold under the given mode: records mode writes an
// explicit value for every player (falling back to 0-0-0) because the matches are not what a
// player's record comes from there; pairings mode only writes a value the user actually set,
// since a `0-0-0` posted for an untouched player would mask every pairing-derived standing.
const effectiveOverride = (
  overrides: TranscribeState['overrides'],
  name: string,
  finalRecordsOnly: boolean,
): WinLossDraw | null =>
  (finalRecordsOnly ? (overrides[name] ?? { wins: 0, losses: 0, draws: 0 }) : overrides[name]) ?? null;

const toDeckSection = (deck: Pick<TranscribeDeck, 'mainboard' | 'sideboard'>) => ({
  mainboard: toOracleIds(deck.mainboard),
  sideboard: toOracleIds(deck.sideboard),
});

const EMPTY_DECK_SECTION = { mainboard: [], sideboard: [] };

// decks and overrides are keyed per player rather than id to survive a rename, but a record
// seeded before Player.id existed has no ids at all — the only identity left for it is the
// seat a player sits in, so the server resolves a key that parses as an integer as a position.
const playerSectionKey = (player: PlayerList[number] | undefined, index: number): string => player?.id ?? String(index);

// One section's value alongside the baseline it is compared against, for whichever of
// toTranscribePayload or dirtySections is asking. Computed once so both stay in lockstep
// instead of drifting into two slightly different definitions of "changed".
interface SectionDiff {
  key: SectionKey;
  value: TranscribeSectionValue;
  baseline: TranscribeSectionValue;
}

const diffSections = (state: TranscribeState, seeded: TranscribeState, finalRecordsOnly: boolean): SectionDiff[] => {
  const diffs: SectionDiff[] = [];

  if (state.name !== seeded.name || state.date !== seeded.date || state.description !== seeded.description) {
    diffs.push({
      key: 'overview',
      value: { name: state.name, date: state.date, description: state.description },
      baseline: { name: seeded.name, date: seeded.date, description: seeded.description },
    });
  }

  if (!samePlayers(state.players, seeded.players) || !sameList(state.seatOrder, seeded.seatOrder)) {
    diffs.push({
      key: 'players',
      value: { players: state.players, seatOrder: state.seatOrder },
      baseline: { players: seeded.players, seatOrder: seeded.seatOrder },
    });
  }

  if (!sameMatches(state.matches, seeded.matches)) {
    diffs.push({ key: 'rounds', value: { matches: state.matches }, baseline: { matches: seeded.matches } });
  }

  if (!sameList(state.trophy, seeded.trophy)) {
    diffs.push({ key: 'trophy', value: { trophy: state.trophy }, baseline: { trophy: seeded.trophy } });
  }

  // Each player's baseline is found through seatOrder rather than by matching the current
  // name or id: seatOrder already carries "which original player is this", through a rename
  // or a reorder, since applyPlayerEdit keeps it pointing at the seat each entry came from.
  state.players.forEach((player, index) => {
    const effective = effectiveOverride(state.overrides, player.name, finalRecordsOnly);
    const origin = state.seatOrder[index] ?? -1;
    const seededPlayer = origin >= 0 ? seeded.players[origin] : undefined;
    const baseline = seededPlayer ? (seeded.overrides[seededPlayer.name] ?? null) : null;
    if (!sameOverride(effective, baseline)) {
      diffs.push({ key: `overrides:${playerSectionKey(player, index)}`, value: effective, baseline });
    }
  });

  for (const [indexKey, deck] of Object.entries(state.decks)) {
    if (!deck.dirty || !deck.editable) {
      continue;
    }
    const index = Number(indexKey);
    const origin = state.seatOrder[index] ?? -1;
    const seededDeck = origin >= 0 ? seeded.decks[origin] : undefined;
    diffs.push({
      key: `decks:${playerSectionKey(state.players[index], index)}`,
      value: toDeckSection(deck),
      baseline: seededDeck ? toDeckSection(seededDeck) : EMPTY_DECK_SECTION,
    });
  }

  return diffs;
};

// Which sections of the record differ from what this workspace loaded. The page's dirty flag,
// and toTranscribePayload's choice of what to submit, are both this and nothing else — a
// section that is not in this list is not sent and does not block navigation.
export const dirtySections = (
  state: TranscribeState,
  seeded: TranscribeState,
  finalRecordsOnly: boolean,
): SectionKey[] => diffSections(state, seeded, finalRecordsOnly).map((diff) => diff.key);

const OVERRIDE_PREFIX = 'overrides:';
const DECK_PREFIX = 'decks:';

// Spreads one section's baseline into SectionBaselines, nesting a per-player override or deck
// under its player key rather than writing it at the top level.
const addBaseline = (baselines: SectionBaselines, key: SectionKey, value: TranscribeSectionValue): void => {
  if (key.startsWith(OVERRIDE_PREFIX)) {
    const playerKey = key.slice(OVERRIDE_PREFIX.length);
    baselines.overrides = { ...baselines.overrides, [playerKey]: value as WinLossDraw | null };
    return;
  }
  if (key.startsWith(DECK_PREFIX)) {
    const playerKey = key.slice(DECK_PREFIX.length);
    baselines.decks = { ...baselines.decks, [playerKey]: value as { mainboard: string[]; sideboard: string[] } };
    return;
  }
  switch (key) {
    case 'overview':
      baselines.overview = value as NonNullable<SectionBaselines['overview']>;
      break;
    case 'players':
      baselines.players = value as NonNullable<SectionBaselines['players']>;
      break;
    case 'rounds':
      baselines.rounds = value as NonNullable<SectionBaselines['rounds']>;
      break;
    case 'trophy':
      baselines.trophy = value as NonNullable<SectionBaselines['trophy']>;
      break;
  }
};

// Builds the body POST /cube/records/enter/:id now accepts: only the sections where `state`
// differs from `seeded`, each paired with the value this workspace loaded for it, so the
// server can apply what is clean and report what someone else changed underneath this save.
export const toTranscribePayload = (
  state: TranscribeState,
  seeded: TranscribeState,
  finalRecordsOnly = false,
): TranscribeSectionsPayload => {
  const sections: TranscribeSectionsPayload['sections'] = {};
  const baselines: SectionBaselines = {};

  for (const diff of diffSections(state, seeded, finalRecordsOnly)) {
    sections[diff.key] = diff.value;
    addBaseline(baselines, diff.key, diff.baseline);
  }

  return { sections, baselines };
};

// Whether the editor holds anything worth saving. A second definition of "changed" would
// drift from dirtySections the moment one of them gained a case the other had not — there is
// exactly one definition, and this is just its length.
export const isDirty = (state: TranscribeState, seeded: TranscribeState, finalRecordsOnly = false): boolean =>
  dirtySections(state, seeded, finalRecordsOnly).length > 0;
