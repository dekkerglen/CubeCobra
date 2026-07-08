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
}
export interface DraftFormat {
  title: string;
  packs: Pack[];
  multiples: boolean;
  markdown?: string;
  html?: string;
  defaultSeats: number;
  basicsBoard?: string; // New: which board to pull basics from (e.g., "Basics")
}

export type DraftState = {
  cards: number[];
  steps: DraftStep[];
}[][];

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
} as const;

export const REVERSE_TYPES: Record<string, string> = {
  g: 'Grid Draft',
  d: 'Draft',
  u: 'Upload',
  s: 'Sealed',
} as const;

export default interface Draft {
  seats: DraftSeat[];
  cards: Card[];
  cube: string;
  InitialState?: DraftState;
  DraftmancerLog?: DraftmancerLog;
  basics: number[]; // Deprecated - kept for backwards compatibility with old cubes
  basicsBoard?: string; // New: which board basics are pulled from
  id: string;
  seed?: string;
  // g: grid, d: draft, u: upload, s: sealed
  type: 'g' | 'd' | 'u' | 's';
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
}
