// Path segment for the ML model bundle served to the browser draft bot.
//
// The client fetches models from the assets CDN under /model/<MODEL_VERSION>/...
// with a 1-year `immutable` cache. Browsers key their HTTP cache on the URL, so
// bumping this string moves the model to a fresh URL that no client has cached.
// That is the ONLY reliable way to roll out a new model: overwriting files at a
// stable URL leaves returning users serving a stale, architecturally-incompatible
// graph from disk cache (e.g. a 160-dim draft_decoder against 128-dim inputs).
//
// Bump this whenever the model architecture or weights change, and publish the
// matching bundle with scripts/uploadMLModel.ts — it mirrors into this same
// /model/<MODEL_VERSION>/ prefix on R2.
//
// Scope note: this versions ONLY the browser path. The recommender service and
// jobs download the model fresh from the flat S3 `model/` prefix on every boot,
// so they have no persistent cache to bust and deliberately stay unversioned.
export const MODEL_VERSION = 'v3';

export default MODEL_VERSION;
