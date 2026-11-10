// The four model-quality metrics used by the promotion gate. packages/ml/ccml/validation.py computes
// the same metrics, the same way, during training, so a run's validation numbers and its gate
// numbers mean the same thing. Change both together.
//
//   cubeRecall    hide every 5th card of a cube (by sorted index), feed the rest, and measure how
//                 many hidden cards appear in the top ceil(1.2 x hidden) scores among cards not fed
//   deckAccuracy  feed a deck's pool (main + side), rank the pool by score, and measure how much of
//                 the top |mainboard| is the mainboard the player built
//   pickTop1/3    feed the pool before a pick and check whether the human's pick ranks first, or in
//                 the top 3, among the cards in the pack
//
// Ties count in the model's favor: only strictly higher scores rank ahead.

export interface CubeCase {
  visible: number[];
  hidden: number[];
}

/** Sorted unique cards; every 5th (positions 0, 5, 10, ...) is hidden. */
export const splitCube = (cards: number[]): CubeCase => {
  const sorted = [...new Set(cards)].sort((a, b) => a - b);
  return {
    visible: sorted.filter((_, i) => i % 5 !== 0),
    hidden: sorted.filter((_, i) => i % 5 === 0),
  };
};

const countAbove = (scores: ArrayLike<number>, candidates: Iterable<number>, threshold: number): number => {
  let count = 0;
  for (const card of candidates) {
    if ((scores[card] ?? 0) > threshold) count += 1;
  }
  return count;
};

export const cubeRecall = (scores: ArrayLike<number>, { visible, hidden }: CubeCase): number => {
  if (hidden.length === 0) return 0;
  const k = Math.ceil(hidden.length * 1.2);
  const fed = new Set(visible);
  const ranked: Array<[number, number]> = [];
  for (let card = 0; card < scores.length; card += 1) {
    if (!fed.has(card)) ranked.push([scores[card] ?? 0, card]);
  }
  ranked.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const top = new Set(ranked.slice(0, k).map(([, card]) => card));
  return hidden.filter((card) => top.has(card)).length / hidden.length;
};

export const deckAccuracy = (scores: ArrayLike<number>, pool: number[], mainboard: number[]): number => {
  const main = new Set(mainboard);
  if (main.size === 0) return 0;
  const ranked = [...new Set(pool)].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a - b);
  return ranked.slice(0, main.size).filter((card) => main.has(card)).length / main.size;
};

/** How many other pack cards the model scores strictly above the human's pick (0 = top pick). */
export const pickRank = (logits: ArrayLike<number>, pack: number[], pick: number): number =>
  countAbove(
    logits,
    [...new Set(pack)].filter((card) => card !== pick),
    logits[pick] ?? 0,
  );

export interface MetricTotals {
  cubeRecall: number[];
  deckAccuracy: number[];
  pickTop1: number[];
  pickTop3: number[];
}

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
