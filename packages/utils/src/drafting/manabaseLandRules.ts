/**
 * Manabase Land Rules
 * ===================
 *
 * Generic non-fetch land heuristics used by trim:
 *   - obvious force-cuts
 *   - "suspect" classification that escalates ambiguous lands to ML reranking
 *   - basic replacement choice for deterministic cuts
 *
 * This file owns policy. If the question is "should this land be treated as bad in this
 * deck?", it belongs here. If the question is "what can this fetch reach?" or "which basic
 * would the deck add?", it belongs in the fetch/basics modules.
 */

import { evaluateFetch, getFetchEntryForOracle, getLandTypesForOracle, hasShuffleSynergy } from './manabaseFetch';
import {
  type BasicCardLike,
  deckCardColors,
  type LandMetaLookup,
  oracleIsLand,
  oracleIsNonBasicLand,
  TYPE_TO_COLOR_LETTER,
  WUBRG,
} from './manabaseShared';

/** Threshold for `oracleIsUnderusedSingleColorLand`: how many non-land spells in the land's
 *  color the deck needs to run before we treat a 1-color utility land as worth its slot. */
const MIN_COLOR_SPELLS_FOR_SINGLE_COLOR_LAND = 3;

/** Typed land whose subtype package contributes fewer than 2 deck colors. */
export function oracleIsForceCutDual(oracle: string, mainDeckColors: Set<string>, cardMeta: LandMetaLookup): boolean {
  if (!oracleIsNonBasicLand(oracle, cardMeta)) return false;
  const types = getLandTypesForOracle(oracle, cardMeta);
  if (types.length < 2) return false;
  const onColorCount = types.filter((type) => {
    const color = TYPE_TO_COLOR_LETTER[type];
    return color !== undefined && mainDeckColors.has(color);
  }).length;
  return onColorCount < 2;
}

/** Every colored thing this land does is off-color for the deck. */
export function oracleIsAllOffColorLand(
  oracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
): boolean {
  if (!oracleIsNonBasicLand(oracle, cardMeta)) return false;
  const landColors = (cardMeta[oracle]?.colorIdentity ?? []).filter((color) => WUBRG.has(color));
  if (landColors.length === 0) return false;
  return landColors.every((color) => !mainDeckColors.has(color));
}

/** Multi-color producer where too much of the fixing is wasted in this deck. */
export function oracleIsUnderusedMultiColorLand(
  oracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
): boolean {
  if (!oracleIsNonBasicLand(oracle, cardMeta)) return false;
  const producedColors = (cardMeta[oracle]?.producedMana ?? []).filter((color) => WUBRG.has(color));
  if (producedColors.length < 2) return false;
  const onColor = producedColors.filter((color) => mainDeckColors.has(color)).length;
  return onColor < 2;
}

/** Single-color utility / splash land where the deck barely uses that color. */
export function oracleIsUnderusedSingleColorLand(
  oracle: string,
  mainboardOracles: string[],
  cardMeta: LandMetaLookup,
): boolean {
  if (!oracleIsNonBasicLand(oracle, cardMeta)) return false;
  const producedColors = (cardMeta[oracle]?.producedMana ?? []).filter((color) => WUBRG.has(color));
  if (producedColors.length !== 1) return false;
  const onlyColor = producedColors[0]!;
  let supportingSpells = 0;
  for (const otherOracle of mainboardOracles) {
    if (otherOracle === oracle) continue;
    if (oracleIsLand(otherOracle, cardMeta)) continue;
    if ((cardMeta[otherOracle]?.colorIdentity ?? []).includes(onlyColor)) supportingSpells += 1;
  }
  return supportingSpells < MIN_COLOR_SPELLS_FOR_SINGLE_COLOR_LAND;
}

/** Heuristic-only "we are confident this should be a basic instead" path. */
export function oracleIsForceCutLand(
  oracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
  mainboardOracles: string[],
  basics: BasicCardLike[] = [],
  deckSize: number = mainboardOracles.length,
): boolean {
  if (oracleIsForceCutDual(oracle, mainDeckColors, cardMeta)) return true;
  if (getFetchEntryForOracle(oracle, cardMeta)) {
    const fetchEval = evaluateFetch(oracle, mainboardOracles, cardMeta, mainDeckColors, basics, deckSize);
    if (fetchEval.quality === 'dead') return true;
  }
  if (oracleIsAllOffColorLand(oracle, mainDeckColors, cardMeta)) return true;
  if (oracleIsUnderusedMultiColorLand(oracle, mainDeckColors, cardMeta)) return true;
  if (oracleIsUnderusedSingleColorLand(oracle, mainboardOracles, cardMeta)) return true;
  return false;
}

/** Deterministic replacement basic for force-cuts. */
export function pickForceCutBasic(
  cutOracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
  basics: BasicCardLike[],
): string | null {
  const types = getLandTypesForOracle(cutOracle, cardMeta);
  for (const type of types) {
    const color = TYPE_TO_COLOR_LETTER[type];
    if (color && mainDeckColors.has(color)) {
      const basic = basics.find((candidate) => (candidate.colorIdentity ?? []).includes(color));
      if (basic) return basic.oracleId;
    }
  }
  for (const color of mainDeckColors) {
    const basic = basics.find((candidate) => (candidate.colorIdentity ?? []).includes(color));
    if (basic) return basic.oracleId;
  }
  return basics[0]?.oracleId ?? null;
}

/** Fetches get their own suspect path because they need deck-aware reachability, not just
 *  a generic produced-mana check. */
function fetchSuspectVerdict(
  oracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
  mainboardOracles: string[],
  basics: BasicCardLike[],
  deckSize: number,
): boolean | null {
  if (!getFetchEntryForOracle(oracle, cardMeta)) return null;
  const fetchEval = evaluateFetch(oracle, mainboardOracles, cardMeta, mainDeckColors, basics, deckSize);
  if (fetchEval.quality === 'real') return false;
  if (fetchEval.quality === 'dead') return true;
  return !hasShuffleSynergy(mainboardOracles, cardMeta);
}

/** Typed lands with 2+ on-color subtypes are real fixing even if they also mention an
 *  off-color subtype. */
function isProtectedTypedDual(oracle: string, mainDeckColors: Set<string>, cardMeta: LandMetaLookup): boolean {
  const typedSubtypes = getLandTypesForOracle(oracle, cardMeta);
  if (typedSubtypes.length < 2) return false;
  const onColor = typedSubtypes.filter((type) => {
    const color = TYPE_TO_COLOR_LETTER[type];
    return color !== undefined && mainDeckColors.has(color);
  }).length;
  return onColor >= 2;
}

/** High-confidence nonbasic lands trim should never reconsider. This is intentionally
 *  conservative: only lands that are clearly real fixing in the current deck context
 *  belong here. */
export function oracleIsMustKeepNonbasicLand(
  oracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
  mainboardOracles: string[],
  basics: BasicCardLike[] = [],
  deckSize: number = mainboardOracles.length,
): boolean {
  if (!oracleIsNonBasicLand(oracle, cardMeta)) return false;
  if (isProtectedTypedDual(oracle, mainDeckColors, cardMeta)) return true;
  if (getFetchEntryForOracle(oracle, cardMeta)) {
    const fetchEval = evaluateFetch(oracle, mainboardOracles, cardMeta, mainDeckColors, basics, deckSize);
    return fetchEval.quality === 'real';
  }
  return false;
}

/** "Should trim spend time reconsidering this nonbasic?" This is broader than force-cut:
 *  some suspect lands are still saved by the ML second opinion. */
export function oracleIsSuspectNonbasicLand(
  oracle: string,
  mainDeckColors: Set<string>,
  cardMeta: LandMetaLookup,
  mainboardOracles?: string[],
  basics: BasicCardLike[] = [],
  deckSize: number = mainboardOracles?.length ?? 0,
): boolean {
  if (!oracleIsNonBasicLand(oracle, cardMeta)) return false;
  if (mainDeckColors.size === 0) return false;

  if (mainboardOracles) {
    const fetchVerdict = fetchSuspectVerdict(oracle, mainDeckColors, cardMeta, mainboardOracles, basics, deckSize);
    if (fetchVerdict !== null) return fetchVerdict;
  }

  const meta = cardMeta[oracle];
  // Generic suspect logic should reason about colored commitment only. Pure colorless
  // utility lands like Wasteland or Rishadan Port are not "off-color" just because they
  // produce {C}; they should only be caught by more specific rules.
  const landColors = deckCardColors(meta ?? { colorIdentity: [] }).filter((color) => WUBRG.has(color));
  if ((meta?.isManaFixingLand ?? false) && landColors.length === 0) return true;

  if (landColors.length >= 2) {
    const shared = landColors.filter((color) => mainDeckColors.has(color)).length;
    if (shared < 2) return true;
  }

  if (isProtectedTypedDual(oracle, mainDeckColors, cardMeta)) return false;

  // This rule mirrors the matching force-cut check on purpose: suspect classification has
  // to surface these lands first so the force-cut path can act on them. Without this entry,
  // a 1-color splash land's only-on-color produced mana would slip past the off-color
  // fallthrough below ("it's in the deck") and never be considered for trim.
  if (mainboardOracles && oracleIsUnderusedSingleColorLand(oracle, mainboardOracles, cardMeta)) {
    return true;
  }

  return landColors.some((color) => !mainDeckColors.has(color));
}
