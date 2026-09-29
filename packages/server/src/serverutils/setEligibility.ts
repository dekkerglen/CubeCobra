import SetInfo from '@utils/datatypes/SetInfo';
import catalog from 'serverutils/cardCatalog';
import { setsWithFirstPrinting } from 'serverutils/cardPrintings';

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

/**
 * The eligible sets that premiered at least one card — the narrower pool for
 * puzzles that ask the player to *name a card from* a set.
 *
 * `isRecognisableSet` admits masters sets, and a masters set is reprint-only:
 * "name a card printed in Ultimate Masters" is not a question about Magic, it's a
 * question about which reprints landed in one specific product, and the same goes
 * for every core set from Unlimited through Tenth Edition. Recognising the set's
 * *name* is a fair ask — which is all the crossword's `setCode` entries and
 * Synergy Connect's set categories need, so `eligibleSetCodes` keeps its meaning
 * and this sits beside it rather than replacing it.
 */
export const eligiblePremiereSetCodes = (date: string): string[] => {
  const premiered = setsWithFirstPrinting();
  return eligibleSetCodes(date).filter((code) => premiered.has(code.toLowerCase()));
};
