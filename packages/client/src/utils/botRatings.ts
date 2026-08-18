import { softmax } from '@utils/drafting/mlScoring';

/** Softmax — for raw logit inputs (e.g., the client-side TF.js bot, which returns
 *  the model's last-layer outputs directly). Don't use this on values that are
 *  already normalized probabilities, since softmax-of-softmax collapses to nearly
 *  uniform. For server-returned ratings (which already include a final-layer
 *  softmax on the ML service side), use `normalizeProbabilities` instead.
 *
 *  Delegates to the shared @utils softmax so the sim display, pack ranking, and
 *  the recommender service all use one implementation. */
export const modelScoresToProbabilities = softmax;

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
