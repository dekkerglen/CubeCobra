/**
 * Manabase Shared
 * ===============
 *
 * Lowest-level primitives shared by the manabase modules:
 *   - metadata shapes (`LandMeta`, `BasicCardLike`)
 *   - color/type constants
 *   - tiny classification helpers like "is this a land?"
 *
 * This file intentionally does NOT contain policy. No fetch evaluation, no trim heuristics,
 * no basic-picking logic. The goal is to keep this layer boring and dependency-light so the
 * other modules can compose it without circular imports or hidden behavior.
 */

/** Minimal land-card metadata the heuristics need. Both client cardMeta entries and an
 *  adapter built from the server's carddb satisfy this shape. */
export interface LandMeta {
  name?: string;
  type: string;
  colorIdentity?: string[];
  producedMana?: string[];
  isManaFixingLand?: boolean;
}

export type LandMetaLookup = Record<string, LandMeta>;

/** Minimal basic-land shape used by `pickForceCutBasic`. */
export interface BasicCardLike {
  oracleId: string;
  type?: string;
  colorIdentity?: string[];
  producedMana?: string[];
}

export const TYPE_TO_COLOR_LETTER: Record<string, string> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

export const COLOR_TO_BASIC_TYPE: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

export const BASIC_LAND_TYPES = Object.keys(TYPE_TO_COLOR_LETTER);
export const WUBRG = new Set(['W', 'U', 'B', 'R', 'G']);

/** "What colors does this card functionally provide or require for land heuristics?"
 *  For lands we prefer `producedMana`; for spells / fallback cases we use `colorIdentity`. */
export function deckCardColors(card: { producedMana?: string[]; colorIdentity?: string[] }): string[] {
  return (card.producedMana ?? []).length > 0 ? (card.producedMana ?? []) : (card.colorIdentity ?? []);
}

/** Broad land check used throughout the trim logic. */
export function oracleIsLand(oracle: string, cardMeta: LandMetaLookup): boolean {
  return /\bLand\b/.test(cardMeta[oracle]?.type ?? '');
}

/** Separate helper because many rules care specifically about basics vs nonbasics. */
export function oracleIsBasicLand(oracle: string, cardMeta: LandMetaLookup): boolean {
  return (cardMeta[oracle]?.type ?? '').toLowerCase().includes('basic land');
}

/** "Is this a non-basic land?" — the gate every nonbasic-only heuristic starts with. */
export function oracleIsNonBasicLand(oracle: string, cardMeta: LandMetaLookup): boolean {
  return oracleIsLand(oracle, cardMeta) && !oracleIsBasicLand(oracle, cardMeta);
}

/** Walk the mainboard, skip lands, and accumulate colorIdentity from spells. Lands don't
 *  count toward the deck's "intended" color set — otherwise an off-color land would justify
 *  its own inclusion. */
export function assessDeckMainColors(mainboardOracles: string[], cardMeta: LandMetaLookup): Set<string> {
  const colors = new Set<string>();
  for (const oracle of mainboardOracles) {
    const meta = cardMeta[oracle];
    if (!meta) continue;
    if (oracleIsLand(oracle, cardMeta)) continue;
    for (const color of meta.colorIdentity ?? []) {
      if (WUBRG.has(color)) colors.add(color);
    }
  }
  return colors;
}
