import {
  nextReloadFailure,
  RELOAD_RETRY_BASE_MS,
  RELOAD_RETRY_MAX_MS,
  shouldReload,
} from '../src/mlutils/reloadPolicy';

describe('shouldReload', () => {
  it('reloads when the pointer moves', () => {
    expect(shouldReload('20270206-153000', 'v3', true, null, 0)).toBe(true);
    expect(shouldReload('v3', 'v3', true, null, 0)).toBe(false);
  });

  it('reloads the served version when its models are broken', () => {
    expect(shouldReload('v3', 'v3', false, null, 0)).toBe(true);
  });

  it('waits out the backoff for a version that failed', () => {
    const failure = nextReloadFailure(null, '20270206-153000', 0);
    expect(shouldReload('20270206-153000', 'v3', true, failure, RELOAD_RETRY_BASE_MS - 1)).toBe(false);
    expect(shouldReload('20270206-153000', 'v3', true, failure, RELOAD_RETRY_BASE_MS)).toBe(true);
    // A newer pointer isn't held back by the old version's failure.
    expect(shouldReload('20270301-120000', 'v3', true, failure, 0)).toBe(true);
  });
});

describe('nextReloadFailure', () => {
  it('doubles the delay for each failure of the same version, up to the cap', () => {
    let failure = nextReloadFailure(null, 'a', 0);
    expect(failure).toEqual({ version: 'a', attempts: 1, retryAt: RELOAD_RETRY_BASE_MS });
    failure = nextReloadFailure(failure, 'a', 0);
    expect(failure.retryAt).toBe(2 * RELOAD_RETRY_BASE_MS);
    for (let i = 0; i < 10; i += 1) failure = nextReloadFailure(failure, 'a', 0);
    expect(failure.retryAt).toBe(RELOAD_RETRY_MAX_MS);
  });

  it('starts over for a different version', () => {
    const failure = nextReloadFailure(nextReloadFailure(null, 'a', 0), 'b', 0);
    expect(failure.attempts).toBe(1);
  });
});
