import SetInfo from '@utils/datatypes/SetInfo';
import catalog from 'serverutils/cardCatalog';

/**
 * Which Magic sets count as "recognisable" — the ones a player can be expected
 * to name. Scryfall lists well over a thousand sets, but most are Duel Decks,
 * oversized reprints, promo drops, tokens and art series; using all of them as
 * puzzle material produces content nobody can solve (ManaMatrix, Synergy
 * Connect) or grids full of three-letter noise (crossword set codes).
 *
 * Shared by every puzzle generator so the notion of a "real set" can't drift
 * between them.
 */
const ELIGIBLE_SET_TYPES = new Set(['expansion', 'core', 'masters']);
const MIN_SET_CARDS = 150;

/** A real paper release with a full card list. */
export const isRecognisableSet = (set: SetInfo): boolean =>
  ELIGIBLE_SET_TYPES.has(set.setType) && !set.digital && set.cardCount >= MIN_SET_CARDS;

/** Recognisable sets released on or before `date` (YYYY-MM-DD), codes sorted. */
export const eligibleSetCodes = (date: string): string[] =>
  Object.values(catalog.setdict)
    .filter((set) => isRecognisableSet(set) && set.releasedAt !== null && set.releasedAt <= date)
    .map((set) => set.code)
    .sort();
