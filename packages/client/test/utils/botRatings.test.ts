import { modelScoresToProbabilities } from '../../src/utils/botRatings';

describe('modelScoresToProbabilities', () => {
  it('converts arbitrary model scores into probabilities', () => {
    const result = modelScoresToProbabilities([-120, -121, -123]);

    expect(result).toHaveLength(3);
    expect(result.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
    expect(result[0]).toBeGreaterThan(result[1] ?? 0);
    expect(result[1]).toBeGreaterThan(result[2] ?? 0);
  });

  it('returns zeros when all scores are non-finite', () => {
    expect(modelScoresToProbabilities([Number.NEGATIVE_INFINITY, Number.NaN])).toEqual([0, 0]);
  });
});
