/**
 * Manabase Basics
 * ===============
 *
 * Shared "which basics would this deck add?" logic.
 *
 * This module owns the basic-allocation algorithm used in two places:
 *   1. the real deckbuilding basics fill
 *   2. fetch evaluation's predicted-basic approximation
 *
 * Keeping that logic in one file is the important bit: when the deckbuilder changes how it
 * adds basics, fetch evaluation should change with it instead of drifting.
 */

import {
  type BasicCardLike,
  COLOR_TO_BASIC_TYPE,
  deckCardColors,
  type LandMetaLookup,
  oracleIsLand,
} from './manabaseShared';

/** Basic-only version of `deckCardColors`. */
function basicCardColors(card: BasicCardLike): string[] {
  return (card.producedMana ?? []).length > 0 ? (card.producedMana ?? []) : (card.colorIdentity ?? []);
}

/** "Demand per current source" signal driving the greedy basic picker. `addedBasics` is
 *  threaded in so each incremental pick can react to prior picks. */
function sourceDemandRatio(
  mainboardOracles: string[],
  cardMeta: LandMetaLookup,
  addedBasics: BasicCardLike[],
): Record<string, number> {
  const sources: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };
  const demand: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const oracle of mainboardOracles) {
    const meta = cardMeta[oracle];
    if (!meta) continue;
    if (oracleIsLand(oracle, cardMeta)) {
      for (const color of deckCardColors(meta)) {
        if (sources[color] !== undefined) sources[color] += 1;
      }
    } else {
      for (const color of meta.colorIdentity ?? []) {
        if (demand[color] !== undefined) demand[color] += 1;
      }
    }
  }
  for (const basic of addedBasics) {
    for (const color of basicCardColors(basic)) {
      if (sources[color] !== undefined) sources[color] += 1;
    }
  }
  return {
    W: (demand.W ?? 0) / (sources.W ?? 1),
    U: (demand.U ?? 0) / (sources.U ?? 1),
    B: (demand.B ?? 0) / (sources.B ?? 1),
    R: (demand.R ?? 0) / (sources.R ?? 1),
    G: (demand.G ?? 0) / (sources.G ?? 1),
  };
}

/** Greedy basic picker shared by both real deckbuilding and fetch prediction. */
export function pickAddedBasics<T extends BasicCardLike>(
  mainboardOracles: string[],
  cardMeta: LandMetaLookup,
  basics: T[],
  deckSize: number,
): T[] {
  const basicLands = basics.filter(
    (basic) => (basic.colorIdentity?.length ?? 0) > 0 && (basic.type ?? '').includes('Land'),
  );
  if (basicLands.length === 0) return [];

  const basicsNeeded = Math.max(0, deckSize - mainboardOracles.length);
  if (basicsNeeded === 0) return [];

  const addedBasics: T[] = [];
  for (let i = 0; i < basicsNeeded; i += 1) {
    const pips = sourceDemandRatio(mainboardOracles, cardMeta, addedBasics);
    let bestBasic = basicLands[0]!;
    let bestScore = basicCardColors(bestBasic).reduce((sum, color) => sum + (pips[color] ?? 0), 0);
    for (let j = 1; j < basicLands.length; j += 1) {
      const candidate = basicLands[j]!;
      const score = basicCardColors(candidate).reduce((sum, color) => sum + (pips[color] ?? 0), 0);
      if (score > bestScore) {
        bestBasic = candidate;
        bestScore = score;
      }
    }
    addedBasics.push(bestBasic);
  }
  return addedBasics;
}

/** Collapse the predicted basic picks into basic-land subtypes for fetch reachability. */
export function predictBasicTypes(
  mainboardOracles: string[],
  cardMeta: LandMetaLookup,
  basics: BasicCardLike[],
  deckSize: number,
): Set<string> {
  const addedBasics = pickAddedBasics(mainboardOracles, cardMeta, basics, deckSize);
  const types = new Set<string>();
  for (const basic of addedBasics) {
    for (const color of basic.colorIdentity ?? []) {
      const type = COLOR_TO_BASIC_TYPE[color];
      if (type) types.add(type);
    }
  }
  return types;
}
