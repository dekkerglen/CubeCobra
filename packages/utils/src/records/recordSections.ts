import { cardOracleId, detailsToCard } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import DraftSeat from '@utils/datatypes/DraftSeat';
import { PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';

// The whole-record sections a transcription workspace can submit independently. `overrides`
// and `decks` are not here: a contributor writes exactly one player's override and one
// player's deck, so they are keyed per player below rather than treated as single blocks.
export type SectionName = 'overview' | 'players' | 'rounds' | 'trophy';

// The suffix on `overrides:` and `decks:` is a player id, not a player name — matches,
// overrides and trophy stay keyed by name in storage, but a section key needs an identity
// that survives a rename, which only the editing-time player id does.
export type SectionKey = SectionName | `overrides:${string}` | `decks:${string}`;

// The baseline a workspace loaded for each section it is about to submit, so the server can
// compare against what is currently stored. Comparison is always by value (see sectionsEqual)
// and never by `dateLastUpdated`: a single timestamp cannot say which section moved, so any
// concurrent write would make every section look stale.
export interface SectionBaselines {
  overview?: { name: string; date: number; description: string };
  players?: { players: PlayerList; seatOrder: number[] };
  rounds?: { matches: Round[] };
  trophy?: { trophy: string[] };
  // null means "no override" for that player, distinct from the key being absent.
  overrides?: { [playerId: string]: WinLossDraw | null };
  decks?: { [playerId: string]: { mainboard: string[]; sideboard: string[] } };
}

// A draft seat's mainboard/sideboard pool is number[][][] of indices into draft.cards —
// nested by pack and pick history. Shared by the client's transcribe state and the server's
// deck projection so a seat pool resolves to the same ordered details on both sides; two
// separate definitions here could drift and make identical decks look like conflicts.
export const flattenSeatPool = (pool: number[][][] | undefined, cards: Card[]): CardDetails[] =>
  (pool ?? [])
    .flat(3)
    .map((cardIndex) => cards[cardIndex]?.details)
    .filter((details): details is CardDetails => !!details);

// Shared with the client's payload builder so a card details list resolves to the same
// ordered oracle ids on both sides — two copies of this one-liner could silently drift.
export const toOracleIds = (details: CardDetails[]): string[] => details.map(detailsToCard).map(cardOracleId);

// The ordered oracle-id projection of one seat's boards — what both the client and the server
// compare a deck section's baseline against. An absent seat (a player with no draft seat yet)
// projects as empty boards rather than throwing, since that is a legitimate baseline.
export const deckProjection = (
  seat: DraftSeat | undefined,
  cards: Card[],
): { mainboard: string[]; sideboard: string[] } => ({
  mainboard: toOracleIds(flattenSeatPool(seat?.mainboard, cards)),
  sideboard: toOracleIds(flattenSeatPool(seat?.sideboard, cards)),
});

// Order-sensitive deep equality: key order must not matter (two objects holding the same data
// but built or serialized differently must still compare equal), but array order must (a
// reordered deck or player list is a different section, not a reformatted one). Deliberately
// not JSON.stringify equality, which is sensitive to key insertion order and would report a
// conflict for two objects that differ only in how they were constructed.
export const sectionsEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray || bIsArray) {
    if (!aIsArray || !bIsArray || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => sectionsEqual(item, b[index]));
  }

  const aEntries = a as Record<string, unknown>;
  const bEntries = b as Record<string, unknown>;
  const aKeys = Object.keys(aEntries);
  const bKeys = Object.keys(bEntries);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bEntries, key) && sectionsEqual(aEntries[key], bEntries[key]),
  );
};
