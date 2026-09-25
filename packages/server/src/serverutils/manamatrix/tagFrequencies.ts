import { isExtraCard } from '@utils/cardutil';
import catalog from 'serverutils/cardCatalog';

import { isTagAllowed } from './categoryPools';

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

/** Test seam: drop the cache so a rebuilt catalog is re-counted. */
export const clearTagCountsCache = (): void => {
  cachedCounts = undefined;
};
