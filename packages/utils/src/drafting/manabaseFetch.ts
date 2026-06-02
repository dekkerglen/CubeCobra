/**
 * Manabase Fetch
 * ==============
 *
 * Fetchland-specific logic and the lookup tables that support it:
 *   - hardcoded fetch cycles (typed fetches + generic basic-fetches)
 *   - shuffle-synergy card names that earn thinning fetches their slot
 *   - typeline parsing for basic land subtypes
 *   - fetch reachability / quality evaluation
 *
 * This file should answer questions like:
 *   - "what basic land subtypes does this card carry?"
 *   - "is this land a fetch, and what can it actually reach in this deck?"
 *
 * It should not decide whether a non-fetch land is suspect or force-cut; that lives in
 * `manabaseLandRules.ts`.
 */

import { predictBasicTypes } from './manabaseBasics';
import { BASIC_LAND_TYPES, type BasicCardLike, type LandMetaLookup, TYPE_TO_COLOR_LETTER } from './manabaseShared';

/** 15 typed fetches (Onslaught + Zendikar + Mirage). Each can grab any land — basic or
 *  nonbasic — whose typeline contains one of the listed subtypes. Mirage slowfetches enter
 *  tapped, but the trim heuristic doesn't model tap-vs-untapped. */
export const FETCHLANDS: Record<string, { types: readonly string[]; basicsOnly: boolean }> = {
  'Flooded Strand': { types: ['Plains', 'Island'], basicsOnly: false },
  'Polluted Delta': { types: ['Island', 'Swamp'], basicsOnly: false },
  'Bloodstained Mire': { types: ['Swamp', 'Mountain'], basicsOnly: false },
  'Wooded Foothills': { types: ['Mountain', 'Forest'], basicsOnly: false },
  'Windswept Heath': { types: ['Plains', 'Forest'], basicsOnly: false },
  'Scalding Tarn': { types: ['Island', 'Mountain'], basicsOnly: false },
  'Verdant Catacombs': { types: ['Swamp', 'Forest'], basicsOnly: false },
  'Arid Mesa': { types: ['Plains', 'Mountain'], basicsOnly: false },
  'Misty Rainforest': { types: ['Forest', 'Island'], basicsOnly: false },
  'Marsh Flats': { types: ['Plains', 'Swamp'], basicsOnly: false },
  'Flood Plain': { types: ['Plains', 'Island'], basicsOnly: false },
  'Bad River': { types: ['Island', 'Swamp'], basicsOnly: false },
  'Rocky Tar Pit': { types: ['Swamp', 'Mountain'], basicsOnly: false },
  'Mountain Valley': { types: ['Mountain', 'Forest'], basicsOnly: false },
  Grasslands: { types: ['Plains', 'Forest'], basicsOnly: false },
};

/** Fetches that can grab any basic land. */
export const GENERIC_BASIC_FETCHLANDS = new Set([
  'Evolving Wilds',
  'Terramorphic Expanse',
  'Fabled Passage',
  'Prismatic Vista',
  'Escape Tunnel',
  'Promising Vein',
]);

/** Cards whose value scales with deck-top control — they let thinning-only fetches still pay
 *  off, so we don't demote a fetch with bestSingle === 1 when one of these is in the deck. */
export const SHUFFLE_SYNERGY_NAMES = new Set([
  'Brainstorm',
  "Sensei's Divining Top",
  'Scroll Rack',
  'Jace, the Mind Sculptor',
  'Sylvan Library',
  'Ponder',
]);

export type FetchQuality = 'real' | 'thinning' | 'dead';

/** Parse basic land subtypes from a Scryfall typeline. "Land — Island Mountain" → [Island,
 *  Mountain]. Untyped fixers return [] and are correctly excluded from fetch reachability.
 *  Accepts both em-dash and hyphen-minus since some data sources normalize the separator. */
export function getLandTypesFromTypeline(typeLine: string): string[] {
  let dashIdx = typeLine.indexOf('—');
  if (dashIdx < 0) dashIdx = typeLine.indexOf(' - ');
  if (dashIdx < 0) return [];
  const subs = typeLine
    .slice(dashIdx + 1)
    .split(/\s+/)
    .filter(Boolean);
  return subs.filter((s) => BASIC_LAND_TYPES.includes(s));
}

/** Canonical land-types lookup: parse straight from the typeline. Cards whose typeline
 *  doesn't carry basic land subtypes (untyped fixers, lands with non-basic subtypes like
 *  Urza or Locus) return `[]` and are correctly excluded from the heuristics that consume
 *  this. */
export function getLandTypesForOracle(oracle: string, cardMeta: LandMetaLookup): string[] {
  return getLandTypesFromTypeline(cardMeta[oracle]?.type ?? '');
}

export function hasShuffleSynergy(mainboardOracles: string[], cardMeta: LandMetaLookup): boolean {
  for (const oracle of mainboardOracles) {
    const name = cardMeta[oracle]?.name;
    if (name && SHUFFLE_SYNERGY_NAMES.has(name)) return true;
  }
  return false;
}

/** Named fetch lookup only. This branch deliberately does not parse oracle text. */
function getFetchlandEntry(name?: string): { types: readonly string[]; basicsOnly: boolean } | null {
  if (!name) return null;
  if (FETCHLANDS[name]) return FETCHLANDS[name]!;
  if (GENERIC_BASIC_FETCHLANDS.has(name)) return { types: BASIC_LAND_TYPES, basicsOnly: true };
  return null;
}

export function getFetchEntryForOracle(
  oracle: string,
  cardMeta: LandMetaLookup,
): { types: readonly string[]; basicsOnly: boolean } | null {
  return getFetchlandEntry(cardMeta[oracle]?.name);
}

/** Evaluate a fetchland against the committed mainboard.
 *  Inputs are already deck-contextual: committed mainboard, predicted added basics, and
 *  the deck's spell-derived colors. Output is intentionally small because callers only need
 *  to know whether the fetch is "real", "thinning", or "dead". */
export function evaluateFetch(
  fetchOracle: string,
  mainboardOracles: string[],
  cardMeta: LandMetaLookup,
  deckColors: Set<string>,
  basics: BasicCardLike[] = [],
  deckSize: number = mainboardOracles.length,
): { quality: FetchQuality; reachable: Set<string>; bestSingle: number } {
  const fetchEntry = getFetchEntryForOracle(fetchOracle, cardMeta);
  if (!fetchEntry) return { quality: 'dead', reachable: new Set(), bestSingle: 0 };

  // Basics get added after trim, so fetch evaluation has to work off the predicted post-fill
  // basic types rather than the current literal mainboard contents.
  const runningBasicTypes = predictBasicTypes(mainboardOracles, cardMeta, basics, deckSize);
  const targets: { colors: string[] }[] = [];
  for (const type of runningBasicTypes) {
    if (fetchEntry.types.includes(type)) {
      const color = TYPE_TO_COLOR_LETTER[type];
      if (color) targets.push({ colors: [color] });
    }
  }

  if (!fetchEntry.basicsOnly) {
    // Typed nonbasic targets matter too: e.g. Polluted Delta can become "real" if it reaches
    // Underground Sea, even if predicted basics alone would only make it "thinning".
    const seenNonbasic = new Set<string>();
    for (const oracle of mainboardOracles) {
      if (oracle === fetchOracle || seenNonbasic.has(oracle)) continue;
      seenNonbasic.add(oracle);
      const meta = cardMeta[oracle];
      if (!meta) continue;
      if (!/\bLand\b/.test(meta.type)) continue;
      if (meta.type.toLowerCase().includes('basic land')) continue;
      const types = getLandTypesForOracle(oracle, cardMeta);
      if (types.length === 0) continue;
      if (!types.some((type) => fetchEntry.types.includes(type))) continue;
      const colors = types.map((type) => TYPE_TO_COLOR_LETTER[type]).filter((color): color is string => !!color);
      targets.push({ colors });
    }
  }

  if (targets.length === 0) return { quality: 'dead', reachable: new Set(), bestSingle: 0 };

  // `reachable` tracks total on-color coverage across all targets; `bestSingle` tracks the
  // best one-shot payoff from any single target. Both matter for the "real vs thinning"
  // distinction.
  const reachable = new Set<string>();
  let bestSingle = 0;
  for (const target of targets) {
    const onColor = target.colors.filter((color) => deckColors.has(color));
    onColor.forEach((color) => reachable.add(color));
    if (onColor.length > bestSingle) bestSingle = onColor.length;
  }
  if (reachable.size === 0) return { quality: 'dead', reachable, bestSingle };
  if (reachable.size >= 2 || bestSingle >= 2) return { quality: 'real', reachable, bestSingle };
  return { quality: 'thinning', reachable, bestSingle };
}
