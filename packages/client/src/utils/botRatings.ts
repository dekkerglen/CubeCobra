/** Softmax — for raw logit inputs (e.g., the client-side TF.js bot, which returns
 *  the model's last-layer outputs directly). Don't use this on values that are
 *  already normalized probabilities, since softmax-of-softmax collapses to nearly
 *  uniform. For server-returned ratings (which already include a final-layer
 *  softmax on the ML service side), use `normalizeProbabilities` instead. */
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

/** Renormalize already-probability-shaped values to sum to 1. Use this for ratings
 *  returned by the server ML service (`/api/draftbots/predict`, `getBotPrediction`,
 *  etc.) — those come back as probabilities already, so a second softmax flattens
 *  them. Defensive against voucher-style summed entries that may exceed 1. */
export const normalizeProbabilities = (values: number[]): number[] => {
  if (values.length === 0) return [];
  const finite = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = finite.reduce((acc, v) => acc + v, 0);
  return total > 0 ? finite.map((v) => v / total) : values.map(() => 0);
};
