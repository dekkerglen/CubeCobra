export const modelScoresToProbabilities = (scores: number[]): number[] => {
  if (scores.length === 0) return [];

  const finiteScores = scores.map((score) => (Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY));
  const maxScore = Math.max(...finiteScores);

  if (!Number.isFinite(maxScore)) {
    return scores.map(() => 0);
  }

  const exps = finiteScores.map((score) => (Number.isFinite(score) ? Math.exp(score - maxScore) : 0));
  const total = exps.reduce((acc, value) => acc + value, 0);

  return total > 0 ? exps.map((value) => value / total) : scores.map(() => 0);
};
