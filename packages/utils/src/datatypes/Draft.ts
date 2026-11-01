import type { DraftLogEntry } from '../drafting/draftEngine';
import Card from './Card';
import DraftSeat from './DraftSeat';
import User from './User';

export type DraftAction = 'pick' | 'pass' | 'trash' | 'pickrandom' | 'trashrandom' | 'endpack';

export type DraftStep = {
  action: DraftAction;
  amount: number | null;
};

export interface CardSlot {
  filter: string;
  /**
   * @deprecated Legacy. Board scope now lives inside the filter string as a
   * `board=...` clause (see compileSlotFilter in drafting/draftFilter.ts).
   * Old data may still have this field set; the editor migrates it into the
   * filter string on load and the server strips it on save. New code should
   * not write this field.
   */
  board?: string;
}

export interface Pack {
  slots: CardSlot[];
  steps: DraftStep[] | null;
  /**
   * When true, the cards in this pack are presented to drafters in a random
   * order rather than in slot order. The shuffle is baked into the draft's
   * InitialState at creation time using the draft seed, so it stays
   * reproducible. Optional and defaults to false for backwards compatibility.
   */
  randomizeOrder?: boolean;
}
export interface DraftFormat {
  title: string;
  packs: Pack[];
  multiples: boolean;
  markdown?: string;
  /**
   * @deprecated Legacy description from before formats used markdown. Only kept for formats
   * without markdown, sanitized to basic formatting on save and again when rendered.
   */
  html?: string;
  defaultSeats: number;
  basicsBoard?: string; // New: which board to pull basics from (e.g., "Basics")
}

export type DraftState = {
  cards: number[];
  steps: DraftStep[];
}[][];

// The pack a Lore Seeker adds to the draft, built when the draft is created. `source`
// is the Lore Seeker's index in the draft's cards.
export interface LoreSeekerPack {
  source: number;
  cards: number[];
  steps: DraftStep[];
}

// One completed Housman-draft exchange: a seat placed `given` into the shared pool and took
// `taken` from it. Persisted (in draft order, grouped by round) so the completed draft can
// render a pick-by-pick breakdown. Both cards are public, so nothing hidden is recorded here.
export interface HousmanLogEntry {
  seat: number;
  round: number; // 0-based
  given: number; // card index placed into the pool
  taken: number; // card index taken from the pool
}

//TODO: Move to Draftmancer types
export interface DraftmancerPick {
  booster: number[];
  pick: number;
}

export interface DraftmancerLog {
  sessionID: string;
  players: DraftmancerPick[][];
}

export const DRAFT_TYPES = {
  GRID: 'g',
  DRAFT: 'd',
  UPLOAD: 'u',
  SEALED: 's',
  HOUSMAN: 'h',
} as const;

export const REVERSE_TYPES: Record<string, string> = {
  g: 'Grid Draft',
  d: 'Draft',
  u: 'Upload',
  s: 'Sealed',
  h: 'Housman Draft',
} as const;

export default interface Draft {
  seats: DraftSeat[];
  cards: Card[];
  cube: string;
  InitialState?: DraftState;
  DraftmancerLog?: DraftmancerLog;
  // Ordered exchange history for Housman drafts, used to render the pick-by-pick breakdown.
  HousmanLog?: HousmanLogEntry[];
  // Packs Lore Seekers can add, Lore Seekers inside those packs included.
  LoreSeekerPacks?: LoreSeekerPack[];
  // Every decision of an in-browser draft, in order (see drafting/draftEngine). Replaying it
  // gives the exact draft, including draft-matters effects. Absent for older drafts.
  DraftLog?: DraftLogEntry[];
  basics: number[]; // Deprecated - kept for backwards compatibility with old cubes
  basicsBoard?: string; // New: which board basics are pulled from
  id: string;
  seed?: string;
  // g: grid, d: draft, u: upload, s: sealed, h: housman
  type: 'g' | 'd' | 'u' | 's' | 'h';
  owner?: string | User;
  cubeOwner: string | User;
  date: Date | number;
  name: string;
  complete: boolean;
  seatNames?: string[];
  // True while bot (AI opponent) decks are still being built asynchronously by the
  // bot-deckbuild Lambda. Set when a draft is finished/published (bot seats hold a
  // cheap naive layout until then); cleared by the Lambda once ML-built decks are
  // written back. The client polls /draft/botstatus/:id on this to show a banner.
  botDecksPending?: boolean;
  // True if the async bot-deck build terminally failed (enqueue error, or exhausted retries
  // into the DLQ). Lets the client show a failed state instead of polling forever; the bot
  // seats keep their naive layout.
  botDecksFailed?: boolean;
  // When `botDecksPending` was set. Read-side backstop: a build that never reports back (a
  // Lambda timeout or crash goes to the DLQ without marking the draft failed) is treated as
  // failed once this is old enough, so a draft can't sit "building…" forever. Unrelated
  // writes (a deck save) must not refresh it, which is why it isn't `dateLastUpdated`.
  botDecksPendingSince?: number;
  // Art crop shown as the deck's preview image in place of the cube's image. Defaults to the
  // drafter's first pick (P1P1) when the draft is saved; the owner can swap it for another card
  // from the deckbuilder. Unset for older decks and for sealed/uploaded decks, which have no picks.
  previewImage?: string;
}

// Deck-building fields a client may submit for a seat when it finishes a draft in the browser
// (grid and Housman drafts). Everything else on a seat (owner, bot, name) stays server-side.
export type SubmittedSeatField = 'mainboard' | 'sideboard' | 'pickorder' | 'trashorder' | 'pickedIndices';

const DECK_BOARD_FIELDS: readonly SubmittedSeatField[] = ['mainboard', 'sideboard'];

// A deck board is rows of columns of card indices; real boards are 1-2 rows of 8 columns.
const MAX_DECK_BOARD_ROWS = 16;
const MAX_DECK_BOARD_COLUMNS = 32;

const isCardIndex = (value: unknown, cardCount: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < cardCount;

/** True when `value` is a list of indices into a draft's `cards`. */
export const isDraftIndexList = (value: unknown, cardCount: number): value is number[] =>
  Array.isArray(value) && value.length <= cardCount && value.every((index) => isCardIndex(index, cardCount));

/** True when `value` is a deck board (rows of columns of card indices) for a draft's `cards`. */
export const isDraftDeckBoard = (value: unknown, cardCount: number): value is number[][][] => {
  if (!Array.isArray(value) || value.length > MAX_DECK_BOARD_ROWS) {
    return false;
  }
  let total = 0;
  for (const row of value) {
    if (!Array.isArray(row) || row.length > MAX_DECK_BOARD_COLUMNS) {
      return false;
    }
    for (const column of row) {
      if (!Array.isArray(column) || !column.every((index) => isCardIndex(index, cardCount))) {
        return false;
      }
      total += column.length;
    }
  }
  return total <= cardCount;
};

/**
 * Applies client-submitted seats to a draft's seats, copying only `fields` after checking their
 * shape. The submission must have one entry per seat. Fields the client leaves out keep their
 * stored value. Returns null when anything is malformed.
 */
export const mergeSubmittedSeats = (
  seats: DraftSeat[],
  submitted: unknown,
  cardCount: number,
  fields: readonly SubmittedSeatField[],
): DraftSeat[] | null => {
  if (!Array.isArray(submitted) || submitted.length !== seats.length) {
    return null;
  }

  const merged: DraftSeat[] = [];
  for (const [index, seat] of seats.entries()) {
    const entry = submitted[index];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return null;
    }
    const updated: DraftSeat = { ...seat };
    for (const field of fields) {
      const value = (entry as Record<string, unknown>)[field];
      if (value === undefined) continue;
      if (DECK_BOARD_FIELDS.includes(field)) {
        if (!isDraftDeckBoard(value, cardCount)) return null;
        updated[field as 'mainboard' | 'sideboard'] = value;
      } else {
        if (!isDraftIndexList(value, cardCount)) return null;
        updated[field as 'pickorder' | 'trashorder' | 'pickedIndices'] = value;
      }
    }
    merged.push(updated);
  }
  return merged;
};
