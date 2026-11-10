import { LEGACY_MODEL_VERSION } from '@utils/ml/modelBundle';

import cloudwatch from './cloudwatch';
import { readModelPointer, syncModelToPointer } from './downloadModel';
import { getServedModelVersion, modelsHealthy, reloadMl } from './ml';
import { nextReloadFailure, type ReloadFailure, shouldReload } from './reloadPolicy';

/**
 * Hot model reload. Promotion only moves model/current.json; each recommender instance notices on
 * its next poll, downloads the new bundle next to the served one, and swaps it in once it loads
 * (see reloadMl), so a promotion costs no restart and no gap in recommendations. GET /version
 * reports the new version only after the swap, which is what the promotion step waits for.
 */
const POLL_INTERVAL_MS = 60 * 1000;

let reloading = false;
let failure: ReloadFailure | null = null;

/**
 * One poll: reloads when the pointer names a version other than the served one, or the served models
 * fail their self-test. Never throws.
 */
export const checkForNewModel = async (rootDir: string, bucket: string): Promise<void> => {
  if (reloading) return;
  reloading = true;
  let target: string | null = null;
  try {
    const pointer = await readModelPointer(bucket);
    target = pointer?.version ?? LEGACY_MODEL_VERSION;
    if (!shouldReload(target, getServedModelVersion(), modelsHealthy(), failure, Date.now())) return;

    console.info(`Model pointer names ${target}; loading it alongside ${getServedModelVersion()}.`);
    if (!(await syncModelToPointer(rootDir, bucket, pointer))) {
      throw new Error(`No model files for ${target}`);
    }
    await reloadMl(rootDir, target);
    failure = null;
    console.info(`Now serving model ${target}.`);
  } catch (err) {
    const error = err as Error;
    if (target === null) {
      // Couldn't read the pointer; the next poll tries again.
      console.warn(`Could not read the model pointer: ${error.message}`);
    } else {
      failure = nextReloadFailure(failure, target, Date.now());
      cloudwatch.error(
        `Loading model ${target} failed (attempt ${failure.attempts}); still serving ${getServedModelVersion()}, ` +
          `retrying after ${new Date(failure.retryAt).toISOString()}: ${error.message}`,
        error.stack || '',
      );
    }
  } finally {
    reloading = false;
  }
};

/** Polls the pointer every minute. Each poll starts only after the previous one finishes. */
export const startModelReloadPolling = (rootDir: string, bucket: string): void => {
  const poll = () => {
    checkForNewModel(rootDir, bucket).finally(() => setTimeout(poll, POLL_INTERVAL_MS).unref());
  };
  setTimeout(poll, POLL_INTERVAL_MS).unref();
};
