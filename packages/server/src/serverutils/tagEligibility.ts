import { isExtraCard } from '@utils/cardutil';
import catalog from 'serverutils/cardCatalog';

/**
 * Which Scryfall Tagger slugs count as "recognisable" — the ones a player can
 * be expected to know as a description of a card. Tagger carries several
 * thousand oracle tags, and the long tail is one-offs, curation bookkeeping and
 * mature-content markers; using all of them as puzzle material produces
 * categories nobody can answer (ManaMatrix) or clues nobody can read (crossword).
 *
 * Shared by every puzzle generator so the notion of a "real tag" can't drift
 * between them, exactly as `setEligibility` is shared for sets. This used to
 * live in `manamatrix/tagFrequencies.ts` and `manamatrix/categoryPools.ts`, back
 * when ManaMatrix was the only consumer.
 */

/**
 * How many distinct cards a tag has to describe before a puzzle may use it.
 * A tag this common is one a player has met; below it, Tagger's long tail of
 * one-offs takes over. Shared so ManaMatrix categories and crossword clues draw
 * on the same pool — about 400 of Tagger's ~4,300 oracle tags clear it.
 */
export const MIN_RECOGNISABLE_TAG_NAMES = 150;

/**
 * Slugs we never want, even when they clear the frequency threshold. Curated
 * over time; substring terms catch whole families of mature-content tags.
 */
const BLOCKED_TAG_SLUGS = new Set(['removed-cards', 'reprint', 'functional-reprint']);
const BLOCKED_TAG_SUBSTRINGS = ['nud', 'sex', 'racis', 'suicid', 'slur'];

export const isTagAllowed = (slug: string): boolean => {
  if (BLOCKED_TAG_SLUGS.has(slug)) {
    return false;
  }
  return !BLOCKED_TAG_SUBSTRINGS.some((term) => slug.includes(term));
};

/**
 * Distinct-card-name counts per Scryfall Tagger slug, so puzzle generation only
 * picks tags with enough valid answers. Built lazily from the in-memory catalog
 * on first use (one pass over all printings) and cached for the process
 * lifetime — the tag dictionary must never be shipped to the client or
 * recomputed per request.
 */
interface TagCounts {
  oracle: Map<string, number>;
  art: Map<string, number>;
}

let cachedCounts: TagCounts | undefined;

const buildTagCounts = (): TagCounts => {
  const oracle = new Map<string, number>();
  const art = new Map<string, number>();

  // Count each card (oracle identity) once per slug. Oracle tags are shared by
  // printings, but art tags are per-illustration, so union them across the
  // card's printings first — a name is a valid answer if ANY printing has the tag.
  for (const ids of Object.values(catalog.oracleToId)) {
    const oracleSlugs = new Set<string>();
    const artSlugs = new Set<string>();

    for (const id of ids) {
      const details = catalog._carddict[id];
      if (!details || isExtraCard(details)) {
        continue;
      }
      for (const slug of details.oracle_tags ?? []) {
        oracleSlugs.add(slug);
      }
      for (const slug of details.art_tags ?? []) {
        artSlugs.add(slug);
      }
    }

    for (const slug of oracleSlugs) {
      oracle.set(slug, (oracle.get(slug) ?? 0) + 1);
    }
    for (const slug of artSlugs) {
      art.set(slug, (art.get(slug) ?? 0) + 1);
    }
  }

  return { oracle, art };
};

export const getTagCounts = (): TagCounts => {
  if (!cachedCounts) {
    cachedCounts = buildTagCounts();
  }
  return cachedCounts;
};

// Sorted so the seeded RNG picks the same tag for the same date regardless of
// catalog object-key insertion order.
const eligibleTags = (counts: Map<string, number>, minNames: number): string[] =>
  [...counts.entries()]
    .filter(([slug, count]) => count >= minNames && isTagAllowed(slug))
    .map(([slug]) => slug)
    .sort();

export const eligibleOracleTags = (minNames: number): string[] => eligibleTags(getTagCounts().oracle, minNames);

export const eligibleArtTags = (minNames: number): string[] => eligibleTags(getTagCounts().art, minNames);

/**
 * The same eligible oracle tags, each with the number of distinct cards
 * carrying it, for callers that also need to rank one card's tags against each
 * other. Every slug here has already cleared `isTagAllowed` and `minNames`, so
 * the count is only used to tell a specific tag from a near-universal one.
 */
export const eligibleOracleTagCounts = (minNames: number): Map<string, number> => {
  const counts = getTagCounts().oracle;
  return new Map(eligibleOracleTags(minNames).map((slug) => [slug, counts.get(slug)!]));
};

/** Test seam: drop the cache so a rebuilt catalog is re-counted. */
export const clearTagCountsCache = (): void => {
  cachedCounts = undefined;
};
