/**
 * Shared, environment-independent post-processing for the draft ML model.
 *
 * The neural-net forward pass (encode pool → decoder → raw logits) is inherently
 * environment-bound: the browser sim runs it via TF.js/WebGL (client draftBot.ts)
 * and the recommender service runs it via TF-node (recommenderService ml.ts). But
 * everything AFTER the forward pass — oracle remapping, the out-of-vocab rule,
 * pack ranking/pick, and the softmax — is pure array/map math with no TF
 * dependency. Historically each runtime reimplemented it, and the two drifted
 * (e.g. out-of-vocab cards scored 0 on the client but were dropped on the server,
 * so no-data cards were first-picked in the sim while ~0% in a normal draft).
 *
 * This module is the single source of truth for that post-processing. Both
 * runtimes import it and inject only their own forward pass. Keep it free of any
 * TF / DOM / Node dependency so it stays importable from client and server alike.
 */

export type RatedCard = { oracle: string; rating: number };

/** Maps an original oracle id to its ML-vocab equivalent for out-of-vocab cards. */
export type OracleRemapping = Record<string, string>;

/** toMl: original → ML oracle. fromMl: ML oracle → all originals that map to it. */
export type SeatMlMaps = { toMl: Record<string, string>; fromMl: Record<string, string[]> };

/**
 * Rating for a card the model has no opinion on: out of the training vocabulary
 * AND with no ML substitute. Ranked at -Infinity so it is never preferred over an
 * in-vocab card whose decoder logit may legitimately be negative. This mirrors the
 * server draft path, which drops out-of-vocab pack cards entirely. (Assigning 0
 * instead made no-data cards — e.g. brand-new sets — win the argmax.)
 */
export const OUT_OF_VOCAB_RATING = -Infinity;

/**
 * Resolve the ML oracle id for an oracle id, applying the remapping for cards not
 * in the training vocabulary (e.g. Black Lotus → most similar known card).
 */
export function mlOracle(oracle: string, remapping?: OracleRemapping): string {
  return remapping?.[oracle] ?? oracle;
}

/**
 * Build an oracle remapping from CardMeta: original oracle id → ML oracle id for
 * cards whose mlOracleId differs (i.e. not in the training vocab).
 */
export function buildOracleRemapping(cardMeta: Record<string, { mlOracleId?: string }>): OracleRemapping {
  const remapping: OracleRemapping = {};
  for (const [oracle, meta] of Object.entries(cardMeta)) {
    if (meta.mlOracleId) remapping[oracle] = meta.mlOracleId;
  }
  return remapping;
}

/**
 * Build the per-seat oracle↔ML maps. Multiple original oracles can share one ML
 * oracle (several unknown cards substituting to the same known card), so fromMl
 * tracks all originals to allow mapping a ranked ML result back.
 */
export function buildSeatMlMaps(poolOracles: string[], remapping?: OracleRemapping): SeatMlMaps {
  const toMl: Record<string, string> = {};
  const fromMl: Record<string, string[]> = {};

  for (const oracle of poolOracles) {
    if (toMl[oracle] !== undefined) continue;
    const mapped = mlOracle(oracle, remapping);
    toMl[oracle] = mapped;
    if (!fromMl[mapped]) fromMl[mapped] = [];
    if (!fromMl[mapped]!.includes(oracle)) fromMl[mapped]!.push(oracle);
  }

  return { toMl, fromMl };
}

/**
 * Numerically stable softmax over raw model scores, returning probabilities that
 * sum to 1. Out-of-vocab entries (OUT_OF_VOCAB_RATING / any non-finite value) get
 * probability 0. If every entry is non-finite (all out-of-vocab) or the exponentials
 * sum to 0, returns all zeros. This is the one softmax used by the sim display, the
 * server /predict response, and pack ranking — do not fork it.
 */
export const softmax = (scores: number[]): number[] => {
  if (scores.length === 0) return [];

  const finiteScores = scores.map((score) => (Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY));
  let maxScore = Number.NEGATIVE_INFINITY;
  for (const score of finiteScores) if (score > maxScore) maxScore = score;

  if (!Number.isFinite(maxScore)) {
    return scores.map(() => 0);
  }

  const exps = finiteScores.map((score) => (Number.isFinite(score) ? Math.exp(score - maxScore) : 0));
  const total = exps.reduce((acc, value) => acc + value, 0);

  return total > 0 ? exps.map((value) => value / total) : scores.map(() => 0);
};

/**
 * Look up the raw model logit for a pack card. Returns undefined when the card is
 * out of vocab (no logit available), which rankPack/pickTop treat as never-take.
 */
export type LogitLookup = (oracle: string) => number | undefined;

/**
 * Rate each pack card by its raw model logit, assigning OUT_OF_VOCAB_RATING to
 * out-of-vocab cards, sorted descending. Returns raw scores — callers apply
 * softmax() for display. Ordering matches the server draft() (softmax is monotonic,
 * so argmax/sort agree with or without it).
 */
export function rankPack(pack: string[], logitFor: LogitLookup): RatedCard[] {
  return pack
    .map((oracle) => {
      const raw = logitFor(oracle);
      return { oracle, rating: raw === undefined ? OUT_OF_VOCAB_RATING : raw };
    })
    .sort((a, b) => b.rating - a.rating);
}

/**
 * Top pick for a pack: argmax of raw logits. Out-of-vocab cards (OUT_OF_VOCAB_RATING)
 * can never win over an in-vocab card. If the pack is empty returns ''; if every card
 * is out-of-vocab the model can't rank them, so fall back to the first card so a pick
 * is always made.
 */
export function pickTop(pack: string[], logitFor: LogitLookup): string {
  if (pack.length === 0) return '';

  let bestOracle = '';
  let bestRaw = OUT_OF_VOCAB_RATING;
  for (const oracle of pack) {
    const raw = logitFor(oracle);
    const rating = raw === undefined ? OUT_OF_VOCAB_RATING : raw;
    if (rating > bestRaw) {
      bestRaw = rating;
      bestOracle = oracle;
    }
  }

  return bestOracle === '' ? pack[0]! : bestOracle;
}
