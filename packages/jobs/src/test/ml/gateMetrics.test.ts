// packages/ml/tests/test_metrics.py checks the Python implementation against these same cases, so
// training-time validation and the promotion gate keep measuring the same thing.
import { cubeRecall, deckAccuracy, pickRank, splitCube } from '../../ml/gateMetrics';

const scoresFrom = (length: number, values: Record<number, number>) =>
  Float32Array.from({ length }, (_, i) => values[i] ?? 0);

describe('splitCube', () => {
  it('hides every fifth card by sorted index and drops duplicates', () => {
    expect(splitCube([7, 3, 3, 9, 1, 5])).toEqual({ visible: [3, 5, 7, 9], hidden: [1] });
    expect(splitCube([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])).toEqual({
      visible: [1, 2, 3, 4, 6, 7, 8, 9],
      hidden: [0, 5],
    });
  });
});

describe('cubeRecall', () => {
  it('counts hidden cards among the top ceil(1.2 x hidden) scores of cards not fed', () => {
    const scores = scoresFrom(12, { 0: 0.9, 5: 0.1, 10: 0.8, 11: 0.7, 1: 1, 2: 1 });
    expect(cubeRecall(scores, { visible: [1, 2, 3, 4, 6, 7, 8, 9], hidden: [0, 5] })).toBe(0.5);
  });

  it('is 0 with nothing hidden', () => {
    expect(cubeRecall(scoresFrom(3, {}), { visible: [1], hidden: [] })).toBe(0);
  });
});

describe('deckAccuracy', () => {
  it('measures the mainboard share of the top-scored pool cards', () => {
    const scores = scoresFrom(6, { 1: 0.9, 2: 0.1, 3: 0.8, 4: 0.2, 5: 1 });
    expect(deckAccuracy(scores, [1, 2, 3, 4], [1, 2])).toBe(0.5);
  });
});

describe('pickRank', () => {
  it('counts pack cards scored strictly above the pick', () => {
    const logits = scoresFrom(4, { 1: 0.5, 2: 0.4, 3: 0.4 });
    expect(pickRank(logits, [1, 2, 3], 2)).toBe(1);
    expect(pickRank(logits, [1, 2, 3], 1)).toBe(0);
  });
});
