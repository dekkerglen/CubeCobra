import { CardDetails } from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record, { applyPlayerRenames, PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';
import { flattenSeatPool, SectionBaselines, SectionKey, SectionName, toOracleIds } from '@utils/records/recordSections';

import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

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
  // The player list as this workspace loaded it (`seeded.players`), sent on every save
  // regardless of whether `players` itself is dirty. `matches`, `trophy` and `overrides`
  // stay keyed by player name in storage, so rebasing a submission's name-keyed content onto
  // the stored name — needed whenever a player was renamed by another writer since this
  // workspace loaded, most commonly a contributor correcting their own name via the share
  // link — requires this identity reference even on a save that never touches `players`.
  // See rebaseNameKeyedSections.
  identity: { players: PlayerList };
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

/**
 * Which part of the form an error belongs to, so it can be shown against that field rather
 * than collected into a list the reader has to match back to the form themselves. Deck errors
 * carry their seat because a record holds one deck per seat and the message has to say whose.
 */
export type ValidationField = 'name' | 'date' | 'description' | 'players' | 'rounds' | `deck:${number}`;

export interface ValidationError {
  field: ValidationField;
  message: string;
}

// Every message for one field, in the order they were raised.
export const errorsFor = (errors: ValidationError[], field: ValidationField): string[] =>
  errors.filter((error) => error.field === field).map((error) => error.message);

// Every message for a group of fields — the sections collect several at once.
export const errorsForAny = (errors: ValidationError[], match: (field: ValidationField) => boolean): string[] =>
  errors.filter((error) => match(error.field)).map((error) => error.message);

// Everything the endpoint's Joi schema would reject, phrased for the person typing. Save is
// held back until this is empty, so a whole transcribed event is never traded for a 400.
export const validationErrors = (state: TranscribeState): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!state.name.trim()) {
    errors.push({ field: 'name', message: 'Give this record a name.' });
  }
  if (state.name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: 'name',
      message: `A record name is at most ${MAX_NAME_LENGTH} characters, and this one has ${state.name.length}.`,
    });
  }
  if (!Number.isFinite(state.date)) {
    errors.push({ field: 'date', message: 'Give this record a date.' });
  }
  // The file importer accepts descriptions up to 5000 characters, so a record can arrive
  // already past this endpoint's cap — which would otherwise only surface as a raw Joi
  // message after the whole event had been typed out.
  if (state.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'description',
      message: `A record description is at most ${MAX_DESCRIPTION_LENGTH} characters, and this one has ${state.description.length}.`,
    });
  }
  if (state.players.length > MAX_PLAYERS) {
    errors.push({
      field: 'players',
      message: `A record holds at most ${MAX_PLAYERS} players, and this one has ${state.players.length}.`,
    });
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
    errors.push({ field: 'players', message: `Two players cannot share a name: ${[...duplicates].join(', ')}.` });
  }

  if (state.matches.length > MAX_ROUNDS) {
    errors.push({
      field: 'rounds',
      message: `A record holds at most ${MAX_ROUNDS} rounds, and this one has ${state.matches.length}.`,
    });
  }

  // Only an edited deck is submitted, so only an edited deck can be rejected for its size.
  for (const [key, deck] of Object.entries(state.decks)) {
    if (!deck.dirty) {
      continue;
    }
    const seat = Number(key);
    const name = state.players[seat]?.name ?? `Seat ${seat + 1}`;
    if (deck.mainboard.length > MAX_DECK_CARDS) {
      errors.push({
        field: `deck:${seat}`,
        message: `${name}'s mainboard has ${deck.mainboard.length} cards, over the ${MAX_DECK_CARDS} limit.`,
      });
    }
    if (deck.sideboard.length > MAX_DECK_CARDS) {
      errors.push({
        field: `deck:${seat}`,
        message: `${name}'s sideboard has ${deck.sideboard.length} cards, over the ${MAX_DECK_CARDS} limit.`,
      });
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
// This applies to both section kinds alike: a `decks:<N>` or `overrides:<N>` key is never a
// player id (ids are never bare integers), so the server must resolve an integer-parsing
// suffix as a seat position for either one, not just decks.
const playerSectionKey = (player: PlayerList[number] | undefined, index: number): string => player?.id ?? String(index);

// One section's value alongside the baseline submitted with it, for whichever of
// toTranscribePayload or dirtySections is asking. Computed once so both stay in lockstep
// instead of drifting into two slightly different definitions of "changed". `baseline` is
// always the value this workspace loaded — for an override that is not necessarily the value
// the diff was judged against, which runs through the seeded mode's synthesis.
interface SectionDiff {
  key: SectionKey;
  value: TranscribeSectionValue;
  baseline: TranscribeSectionValue;
}

const diffSections = (
  state: TranscribeState,
  seeded: TranscribeState,
  finalRecordsOnly: boolean,
  // The mode the record was loaded in (or last saved under), as opposed to `finalRecordsOnly`
  // above, which is whatever mode is on screen right now. Both sides of an override diff must
  // run through the same effectiveOverride synthesis — applying it only to `state` and reading
  // `seeded` raw reports a diff for every player with no stored override the moment a record
  // merely opens in records mode, with nothing the user touched.
  seededFinalRecordsOnly: boolean = false,
): SectionDiff[] => {
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
    const baseline = seededPlayer
      ? effectiveOverride(seeded.overrides, seededPlayer.name, seededFinalRecordsOnly)
      : null;
    if (!sameOverride(effective, baseline)) {
      // Submitted against what this workspace *loaded*, never against the value the seeded
      // mode synthesizes above. The synthesis is a presentation rule — records mode shows an
      // unset player as 0-0-0 — and storage holds nothing at all for such a player, so sending
      // the synthesized 0-0-0 as "what I loaded" makes the endpoint read the section as
      // changed by someone else on every attempt. "Keep mine" cannot break that loop either:
      // it re-baselines to the stored absence this side already had, and the next save
      // synthesizes the 0-0-0 right back.
      const stored = seededPlayer ? (seeded.overrides[seededPlayer.name] ?? null) : null;
      diffs.push({ key: `overrides:${playerSectionKey(player, index)}`, value: effective, baseline: stored });
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
  seededFinalRecordsOnly = false,
): SectionKey[] => diffSections(state, seeded, finalRecordsOnly, seededFinalRecordsOnly).map((diff) => diff.key);

const OVERRIDE_PREFIX = 'overrides:';
const DECK_PREFIX = 'decks:';

// Spreads one section's value into a SectionBaselines-shaped object, nesting a per-player
// override or deck under its player key rather than writing it at the top level. Used to
// build what toTranscribePayload submits, and reused (with the submitted *value* rather than
// a baseline) as the fallback record for a response that doesn't echo one — see
// fallbackRecord below.
export const addBaseline = (baselines: SectionBaselines, key: SectionKey, value: TranscribeSectionValue): void => {
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
  seededFinalRecordsOnly = false,
): TranscribeSectionsPayload => {
  const sections: TranscribeSectionsPayload['sections'] = {};
  const baselines: SectionBaselines = {};

  for (const diff of diffSections(state, seeded, finalRecordsOnly, seededFinalRecordsOnly)) {
    sections[diff.key] = diff.value;
    addBaseline(baselines, diff.key, diff.baseline);
  }

  return { sections, baselines, identity: { players: seeded.players } };
};

// Whether the editor holds anything worth saving. A second definition of "changed" would
// drift from dirtySections the moment one of them gained a case the other had not — there is
// exactly one definition, and this is just its length.
export const isDirty = (
  state: TranscribeState,
  seeded: TranscribeState,
  finalRecordsOnly = false,
  seededFinalRecordsOnly = false,
): boolean => dirtySections(state, seeded, finalRecordsOnly, seededFinalRecordsOnly).length > 0;

// --- Conflict reporting and resolution --------------------------------------------------
//
// POST /cube/records/enter/:id answers with { applied, conflicts, record }: which sections
// landed, which were refused because someone else changed them first, and the post-write
// value of every applied one. Everything below turns that into workspace updates — re-seeding
// what landed, and letting the user resolve what didn't without losing anything they typed.

// Exactly what the endpoint reports for a section it refused: the key, and whatever it
// currently holds for it. `stored` is already unwrapped to that one section's own shape —
// never nested under SectionBaselines the way `record` is, since a conflict is about one
// section at a time.
export interface SaveConflict {
  section: SectionKey;
  stored: unknown;
}

// Mirrors the server's resolvePlayerIndex: a digit-only suffix is a seat position, never a
// player id (ids are never bare integers), so a key playerSectionKey built resolves back to
// the same player on whichever side reads it.
export const resolvePlayerIndex = (rawKey: string, players: PlayerList): number =>
  /^\d+$/.test(rawKey) ? Number(rawKey) : players.findIndex((player) => player.id === rawKey);

// Where this key's player sits in `seeded`'s own arrays. A digit suffix is a seat position in
// *live* `state`, so it is translated through `state.seatOrder` to the seeded-side position
// that player came from; only a stable id can be looked up directly in `seeded.players`,
// unaffected by a reorder still sitting unsaved in `state`.
const seededIndexFor = (state: TranscribeState, seeded: TranscribeState, rawKey: string): number =>
  /^\d+$/.test(rawKey)
    ? (state.seatOrder[Number(rawKey)] ?? -1)
    : seeded.players.findIndex((player) => player.id === rawKey);

const withOverride = (workspace: TranscribeState, index: number, value: WinLossDraw | null): TranscribeState => {
  const player = workspace.players[index];
  if (!player) {
    return workspace;
  }
  const overrides = { ...workspace.overrides };
  if (value === null) {
    delete overrides[player.name];
  } else {
    overrides[player.name] = value;
  }
  return { ...workspace, overrides };
};

const withDeck = (workspace: TranscribeState, index: number, deck: TranscribeDeck): TranscribeState =>
  index >= 0 && workspace.decks[index] ? { ...workspace, decks: { ...workspace.decks, [index]: deck } } : workspace;

// A deck section's stored value is oracle ids, not CardDetails — all this workspace or the
// server ever compares a deck by. The placeholder the rest of the app already shows while a
// real card's details are still loading keeps the round trip type-safe without inventing card
// data nobody asked for; nothing reads its blank name except a conflict a user chose to keep
// the stored side of.
const deckFromOracleIds = (
  previous: TranscribeDeck,
  value: { mainboard: string[]; sideboard: string[] },
): TranscribeDeck => ({
  ...previous,
  mainboard: value.mainboard.map((oracleId) => ({ ...getPlaceholderCardDetails(oracleId), oracle_id: oracleId })),
  sideboard: value.sideboard.map((oracleId) => ({ ...getPlaceholderCardDetails(oracleId), oracle_id: oracleId })),
  dirty: false,
});

const applyWholeSection = (workspace: TranscribeState, key: SectionName, value: unknown): TranscribeState => {
  switch (key) {
    case 'overview': {
      const typed = value as NonNullable<SectionBaselines['overview']>;
      return { ...workspace, name: typed.name, date: typed.date, description: typed.description };
    }
    case 'players': {
      const typed = value as NonNullable<SectionBaselines['players']>;
      return { ...workspace, players: typed.players.map((player) => ({ ...player })), seatOrder: [...typed.seatOrder] };
    }
    case 'rounds': {
      const typed = value as NonNullable<SectionBaselines['rounds']>;
      return { ...workspace, matches: copyMatches(typed.matches) };
    }
    case 'trophy': {
      const typed = value as NonNullable<SectionBaselines['trophy']>;
      return { ...workspace, trophy: [...typed.trophy] };
    }
  }
};

// Applies one section's resolved value — a conflict's `stored`, in a resolution, or the
// response's echo in reconcileAfterSave — to one side of the workspace, at the position
// *that side's own* arrays hold it at. Shared by both conflict resolutions and the post-save
// reconciliation so an overrides or decks key means the same position lookup everywhere it
// is read.
const applyResolvedSection = (
  workspace: TranscribeState,
  key: SectionKey,
  index: number,
  value: unknown,
): TranscribeState => {
  if (key.startsWith(OVERRIDE_PREFIX)) {
    return index === -1 ? workspace : withOverride(workspace, index, value as WinLossDraw | null);
  }
  if (key.startsWith(DECK_PREFIX)) {
    if (index === -1 || !workspace.decks[index]) {
      return workspace;
    }
    return withDeck(
      workspace,
      index,
      deckFromOracleIds(workspace.decks[index], value as { mainboard: string[]; sideboard: string[] }),
    );
  }
  return applyWholeSection(workspace, key as SectionName, value);
};

const rawPlayerKey = (key: SectionKey): string | undefined => {
  if (key.startsWith(OVERRIDE_PREFIX)) {
    return key.slice(OVERRIDE_PREFIX.length);
  }
  if (key.startsWith(DECK_PREFIX)) {
    return key.slice(DECK_PREFIX.length);
  }
  return undefined;
};

// "Keep theirs": this section's local edit is discarded outright — both sides take the
// server's current value, so the section reads clean immediately and nothing it held
// survives the resolution.
export const keepStoredSection = (
  state: TranscribeState,
  seeded: TranscribeState,
  conflict: SaveConflict,
): { state: TranscribeState; seeded: TranscribeState } => {
  const raw = rawPlayerKey(conflict.section);
  const stateIndex = raw === undefined ? -1 : resolvePlayerIndex(raw, state.players);
  const seededIndex = raw === undefined ? -1 : seededIndexFor(state, seeded, raw);
  return {
    state: applyResolvedSection(state, conflict.section, stateIndex, conflict.stored),
    seeded: applyResolvedSection(seeded, conflict.section, seededIndex, conflict.stored),
  };
};

// "Keep mine": only `seeded` moves to the stored value — a deliberate second action. The
// local edit survives untouched and stays dirty, so the next Save resubmits it against a
// baseline that now matches storage, overwriting it instead of being refused again.
export const keepLocalSection = (
  state: TranscribeState,
  seeded: TranscribeState,
  conflict: SaveConflict,
): TranscribeState => {
  const raw = rawPlayerKey(conflict.section);
  const seededIndex = raw === undefined ? -1 : seededIndexFor(state, seeded, raw);
  return applyResolvedSection(seeded, conflict.section, seededIndex, conflict.stored);
};

// The record to reconcile against when a response doesn't echo one — an endpoint this page
// doesn't recognize as conflict-aware. Treating "what was submitted" as "what landed" is
// exactly the assumption the page made before conflicts existed, and is sound here for the
// same reason `appliedKeys` falls back to every submitted key: a response with none of the
// new fields is read as the old atomic contract, not as "nothing happened".
export const fallbackRecord = (sections: TranscribeSectionsPayload['sections']): SectionBaselines => {
  const record: SectionBaselines = {};
  for (const [key, value] of Object.entries(sections)) {
    if (value === undefined) {
      continue;
    }
    if (key === 'players') {
      // The real endpoint always echoes `players` with an identity seatOrder — it has just
      // realigned the draft's seats into the submitted order, so that is the only sound
      // value here too, not whatever permutation this save happened to submit.
      const typed = value as NonNullable<SectionBaselines['players']>;
      addBaseline(record, key, { players: typed.players, seatOrder: typed.players.map((_, index) => index) });
      continue;
    }
    addBaseline(record, key as SectionKey, value);
  }
  return record;
};

// After a save lands, reconciles `seeded` (and the few corners of `state` that must move in
// lockstep — seatOrder, a deck's dirty flag) against what the server actually did. Every
// applied section's baseline comes from `record`, the server's post-write echo — never from
// what was submitted, since the server may have minted a player id, rebased a renamed
// player's matches or trophy, or resolved a brand new player's override. A section not in
// `applied` is a conflict and is left exactly as the user had it.
export const reconcileAfterSave = (
  state: TranscribeState,
  seeded: TranscribeState,
  applied: SectionKey[],
  record: SectionBaselines,
): { state: TranscribeState; seeded: TranscribeState } => {
  let nextState = state;
  let nextSeeded = seeded;
  const playersApplied = applied.includes('players');

  for (const key of ['overview', 'players', 'rounds', 'trophy'] as const) {
    const value = record[key];
    if (applied.includes(key) && value !== undefined) {
      nextSeeded = applyWholeSection(nextSeeded, key, value);
    }
  }

  // Sound only because `players` itself just applied: the server has realigned the draft's
  // seats (and this echo's seatOrder) into the submitted order, so identity is the only
  // seatOrder that addresses them correctly from here on — for `state` too, since it holds
  // the seats this workspace must keep addressing by the same scheme as `seeded`.
  if (playersApplied && record.players) {
    nextState = { ...nextState, seatOrder: [...record.players.seatOrder] };

    // `seeded.decks` is index-keyed, unlike `overrides` (keyed by name), so a reorder that
    // just applied leaves it pointing at the wrong player for anyone whose deck wasn't itself
    // part of this save — the very next deck edit on that player would diff/submit against a
    // different player's stored deck, self-inflicting a future conflict. Re-key every player
    // from the old position (`state.seatOrder`, read before the overwrite above) to the new
    // one, the same old->new carry `movePastes` already does for a pending paste.
    const rekeyedDecks: TranscribeState['decks'] = {};
    state.players.forEach((_, index) => {
      const origin = state.seatOrder[index] ?? -1;
      const deck = origin >= 0 ? seeded.decks[origin] : undefined;
      if (deck) {
        rekeyedDecks[index] = deck;
      }
    });
    nextSeeded = { ...nextSeeded, decks: rekeyedDecks };
  }

  for (const key of applied) {
    const raw = rawPlayerKey(key);
    if (raw === undefined) {
      continue;
    }
    const index = resolvePlayerIndex(raw, state.players);
    if (index === -1) {
      continue;
    }
    // Identity once `players` itself applied this same save (the server preserves submission
    // order when assigning ids, so position i there is position i here); otherwise wherever
    // this player's seat already pointed — a section untouched this save keeps addressing
    // seeded exactly as it always did.
    const origin = playersApplied ? index : (state.seatOrder[index] ?? -1);
    if (origin === -1) {
      continue;
    }

    if (key.startsWith(DECK_PREFIX)) {
      if (!state.decks[index]) {
        continue;
      }
      // The stored content is exactly what was submitted — nothing server-side renames or
      // reorders a deck's cards — so the CardDetails this workspace already has are reused
      // rather than rebuilt, lossily, from the response's oracle-id echo.
      const settled = { ...state.decks[index], dirty: false };
      nextState = { ...nextState, decks: { ...nextState.decks, [index]: settled } };
      nextSeeded = withDeck(nextSeeded, origin, settled);
      continue;
    }

    const value = record.overrides?.[raw];
    if (value !== undefined) {
      nextSeeded = withOverride(nextSeeded, origin, value);
    }
  }

  return { state: nextState, seeded: nextSeeded };
};
