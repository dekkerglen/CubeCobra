import { isValidModelVersion } from './ml/modelBundle';

// Path segment for the ML model bundle served to the browser draft bot.
//
// The client fetches models from the assets CDN under /model/<version>/... with a
// 1-year `immutable` cache. Browsers key their HTTP cache on the URL, so a new
// version moves the model to a fresh URL that no client has cached. That is the
// ONLY reliable way to roll out a new model: overwriting files at a stable URL
// leaves returning users serving a stale, architecturally-incompatible graph from
// disk cache (e.g. a 160-dim draft_decoder against 128-dim inputs).
//
// The version now comes from the server's model pointer (model/current.json in the
// data bucket, see @utils/ml/modelBundle) at runtime: render.ts passes it to every
// page as reactProps.modelVersion, so promoting or rolling back a model needs no
// client redeploy. The retraining pipeline publishes each bundle to the matching
// /model/<version>/ prefix on R2 before it can be promoted.
//
// MODEL_VERSION is the fallback for pages rendered without a pointer version.
export const MODEL_VERSION = 'v3';

// Browser: read from window.reactProps.modelVersion, populated by render.ts.
export const getModelVersion = (): string => {
  if (typeof window !== 'undefined') {
    const fromProps = (window as unknown as { reactProps?: { modelVersion?: string } }).reactProps?.modelVersion;
    if (isValidModelVersion(fromProps)) return fromProps;
  }
  return MODEL_VERSION;
};

export default MODEL_VERSION;
