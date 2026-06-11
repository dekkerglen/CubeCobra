import type { BuiltDeck, CardMeta, SimulatedPickCard, SimulatedPool } from '@utils/datatypes/SimulationReport';

const WUBRG = new Set(['W', 'U', 'B', 'R', 'G']);

export interface ColorPathAnchorPicks {
  // First pick (restricted to the mainboard when a deck is available) that committed to one of
  // the deck's final colors.
  firstColorAnchorPick: SimulatedPickCard | null;
  // First pick that committed to the deck's *second* final color — the crossover/bridge card.
  secondColorBridgePick: SimulatedPickCard | null;
  // Pick at which every final color had been committed to.
  finalColorsSetPick: SimulatedPickCard | null;
}

/**
 * Walk a pool's pick sequence and find the picks that established its final colors.
 * Off-color picks (cards with an identity outside the deck's final colors) are skipped so
 * speculative picks that never made the deck don't get credited as the anchor.
 */
export function getColorPathAnchorPicks(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
): ColorPathAnchorPicks {
  const finalMainColors = new Set(pool.archetype.split('').filter((color) => WUBRG.has(color)));
  if (finalMainColors.size === 0) {
    return { firstColorAnchorPick: null, secondColorBridgePick: null, finalColorsSetPick: null };
  }

  const mainboard = deck ? new Set(deck.mainboard) : null;
  const seenFinalColors = new Set<string>();
  let firstColorAnchorPick: SimulatedPickCard | null = null;
  let secondColorBridgePick: SimulatedPickCard | null = null;
  let finalColorsSetPick: SimulatedPickCard | null = null;
  for (const pick of pool.picks) {
    if (mainboard && !mainboard.has(pick.oracle_id)) continue;
    const cardColors = (cardMeta[pick.oracle_id]?.colorIdentity ?? []).filter((color) => WUBRG.has(color));
    if (cardColors.length > 0 && cardColors.some((color) => !finalMainColors.has(color))) continue;
    const pickColors = cardColors.filter((color) => finalMainColors.has(color));
    if (pickColors.length === 0) continue;
    const newColors = pickColors.filter((color) => !seenFinalColors.has(color));
    if (newColors.length === 0) continue;
    if (!firstColorAnchorPick) firstColorAnchorPick = pick;
    if (seenFinalColors.size > 0 && !secondColorBridgePick) secondColorBridgePick = pick;
    for (const color of newColors) seenFinalColors.add(color);
    if (!finalColorsSetPick && seenFinalColors.size === finalMainColors.size) finalColorsSetPick = pick;
    if (secondColorBridgePick && finalColorsSetPick) break;
  }
  return { firstColorAnchorPick, secondColorBridgePick, finalColorsSetPick };
}
