// When the model reloader should try a version. A version that failed to download or load is retried
// with exponential backoff, so a broken bundle isn't fetched and loaded on every poll.
export const RELOAD_RETRY_BASE_MS = 2 * 60 * 1000;
export const RELOAD_RETRY_MAX_MS = 60 * 60 * 1000;

export interface ReloadFailure {
  version: string;
  attempts: number;
  retryAt: number;
}

// A reload is due when the pointer moved, or when the served models are broken (a partial load at
// startup), unless that version is still backing off.
export const shouldReload = (
  pointerVersion: string,
  servedVersion: string,
  servedHealthy: boolean,
  failure: ReloadFailure | null,
  now: number,
): boolean =>
  (pointerVersion !== servedVersion || !servedHealthy) &&
  !(failure?.version === pointerVersion && now < failure.retryAt);

export const nextReloadFailure = (previous: ReloadFailure | null, version: string, now: number): ReloadFailure => {
  const attempts = previous?.version === version ? previous.attempts + 1 : 1;
  const delay = Math.min(RELOAD_RETRY_BASE_MS * 2 ** (attempts - 1), RELOAD_RETRY_MAX_MS);
  return { version, attempts, retryAt: now + delay };
};
