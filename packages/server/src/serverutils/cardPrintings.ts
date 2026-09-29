import { isExtraCard, normalizeName } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import catalog from 'serverutils/cardCatalog';

/**
 * Which printing of a card counts as *the* card, and which of a card's names is
 * its real one.
 *
 * Two different questions, one answer, because both come out of the same pass:
 * the catalog holds every printing of every card under every name it was ever
 * printed with, and a puzzle that picks an arbitrary one gets a reskin's name
 * ("Party Tree" for The Great Henge) or a Secret Lair's art for an iconic card.
 *
 * Shared by every puzzle generator — crossword clues, ManaMatrix answers and
 * art — so "the card's own name" and "the card's own printing" can't drift
 * between them, exactly as `setEligibility` is shared for sets and
 * `tagEligibility` for Tagger slugs. This used to live in
 * `crossword/vocabulary.ts`, back when the crossword was the only consumer.
 */

/**
 * Whether `candidate` is a better claim to being a name's original printing than
 * `incumbent`.
 *
 * printedCardList is *not* ordered oldest-first — a name's printings arrive in
 * whatever order the catalog holds them, so "Disintegrate" turns up under Summer
 * Magic and "Artisan of Kozilek" under Ultimate Masters. Taking the first one
 * seen made every recognisable set look as though something had premiered there,
 * which is why `reprintOnly` was false for all 97 crossword set codes including
 * TSR, UMA and SUM. So the original is picked explicitly: a non-reprint beats a
 * reprint, then the earlier set in release order, then the earlier release date.
 */
export const isEarlierPrinting = (candidate: CardDetails, incumbent: CardDetails): boolean => {
  const rank = (details: CardDetails): [number, number, string] => [
    details.reprint === false ? 0 : 1,
    details.setIndex >= 0 ? details.setIndex : Number.MAX_SAFE_INTEGER,
    details.released_at || '9999-99-99',
  ];
  const [aOriginal, aSet, aDate] = rank(candidate);
  const [bOriginal, bSet, bDate] = rank(incumbent);
  if (aOriginal !== bOriginal) {
    return aOriginal < bOriginal;
  }
  if (aSet !== bSet) {
    return aSet < bSet;
  }
  return aDate < bDate;
};

interface PrintingIndex {
  /**
   * Every card name the catalog knows (including reskin names) -> the printing
   * that *is* the card: the earliest printing sharing its oracle id.
   */
  canonicalByName: Map<string, CardDetails>;
  /** The original printing of every distinct *real* card name, reskins dropped. */
  originals: Map<string, CardDetails>;
  /** Lowercase codes of sets where at least one card had its first printing. */
  premiereSets: Set<string>;
}

let cached: PrintingIndex | undefined;

const buildIndex = (): PrintingIndex => {
  // Earliest printing under each exact name, and earliest printing per card
  // regardless of the name it wore. Insertion order follows printedCardList, so
  // everything derived from these stays deterministic.
  const earliestByName = new Map<string, CardDetails>();
  const earliestByOracleId = new Map<string, CardDetails>();

  for (const details of catalog.printedCardList) {
    if (isExtraCard(details)) {
      continue;
    }
    const incumbent = earliestByName.get(details.name_lower);
    if (!incumbent || isEarlierPrinting(details, incumbent)) {
      earliestByName.set(details.name_lower, details);
    }
    const oracleId = details.oracle_id;
    if (oracleId) {
      const earliest = earliestByOracleId.get(oracleId);
      if (!earliest || isEarlierPrinting(details, earliest)) {
        earliestByOracleId.set(oracleId, details);
      }
    }
  }

  // A printing that shares an oracle id with an earlier card under a different
  // name is the same card wearing a costume — "Paradise Chocobo" is Birds of
  // Paradise, "Krang's Android" is Triskelion, "Party Tree" is The Great Henge.
  // 979 oracle ids in the catalog carry more than one name.
  //
  // For the crossword they can't be clued at all: the clue describes the card's
  // real attributes, so a reskin's name is never deducible from them, and the
  // type line still names the original — which produced "type line includes
  // Chandra" for an answer of MEIKO. For ManaMatrix the reskin is a perfectly
  // good answer, but showing it back to the player as the answer's name is not,
  // so the two consumers want the two halves of the same mapping: `originals`
  // drops the costume, `canonicalByName` sees through it.
  const canonicalByName = new Map<string, CardDetails>();
  const originals = new Map<string, CardDetails>();
  const premiereSets = new Set<string>();

  for (const [nameLower, details] of earliestByName) {
    // A card with no oracle id is its own canonical printing; nothing else can
    // be shown to be the same card.
    const canonical = (details.oracle_id ? earliestByOracleId.get(details.oracle_id) : undefined) ?? details;
    canonicalByName.set(nameLower, canonical);

    if (canonical.name_lower === nameLower) {
      originals.set(nameLower, details);
      if (details.set) {
        premiereSets.add(details.set.toLowerCase());
      }
    }
  }

  return { canonicalByName, originals, premiereSets };
};

const getPrintingIndex = (): PrintingIndex => {
  if (!cached) {
    const start = Date.now();
    cached = buildIndex();
    console.info(
      `Card printing index built in ${Date.now() - start}ms: ${cached.originals.size} card names, ` +
        `${cached.canonicalByName.size - cached.originals.size} reskins, ${cached.premiereSets.size} sets with a premiere`,
    );
  }
  return cached;
};

/**
 * The original printing of every distinct card name, keyed by `name_lower`, in
 * first-seen order. Reskin names are absent: only the name the card was first
 * printed under is here.
 *
 * Everything derived from a single card — its set, its rules text, the rarity a
 * clue may state — has to come from one printing, and the original is the only
 * one that makes "first printed in" and "premiered here" true. See
 * `isEarlierPrinting`: the catalog's order is not it.
 *
 * The returned map is the cached one; treat it as read-only.
 */
export const originalPrintings = (): Map<string, CardDetails> => getPrintingIndex().originals;

/**
 * The printing that *is* the card behind a name — the earliest printing sharing
 * its oracle id — or undefined when no non-extra printing goes by that name.
 *
 * Feeding it a reskin's name gets the original back ("party tree" -> The Great
 * Henge), which is what makes it the answer to both "what is this card really
 * called" and "which art should a card default to".
 */
export const canonicalPrintingForName = (name: string): CardDetails | undefined =>
  getPrintingIndex().canonicalByName.get(normalizeName(name));

/**
 * A card's real printed name, given any name it has ever been printed under.
 * Unknown names come back unchanged — callers display user input through this,
 * and a name the catalog doesn't recognise is still the best thing to show.
 */
export const canonicalCardName = (name: string): string => canonicalPrintingForName(name)?.name ?? name;

/**
 * Lowercase codes of every set where at least one card had its *first* printing.
 * Anything absent is reprint-only: Modern Masters, Ultimate Masters, Time Spiral
 * Remastered. Puzzles that ask "name a card from this set" need this, because a
 * reprint-only set asks the player to recall which reprints landed in one
 * specific product rather than anything about Magic.
 *
 * The returned set is the cached one; treat it as read-only.
 */
export const setsWithFirstPrinting = (): Set<string> => getPrintingIndex().premiereSets;

/** Test seam: drop the cache so a rebuilt catalog is re-scanned. */
export const clearPrintingIndexCache = (): void => {
  cached = undefined;
};
