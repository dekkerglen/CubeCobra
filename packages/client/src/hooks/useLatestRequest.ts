import { useCallback, useEffect, useRef } from 'react';

export interface TrackedRequest {
  /** Pass to fetch so a superseded request stops transferring instead of being ignored. */
  signal: AbortSignal;
  /** True only while this is still the most recently started request. */
  isCurrent: () => boolean;
}

/**
 * Tracks which request a response belongs to, for a component where several can be in flight.
 *
 * Responses don't arrive in the order they were asked for, so a slow earlier search can land
 * on top of a newer one and leave the controls, the url and the results describing three
 * different searches. Guard every response with `isCurrent()` before applying it — including
 * in catch and finally, where an aborted request would otherwise clear the loading state of
 * the request that replaced it.
 */
const useLatestRequest = () => {
  const latest = useRef(0);
  const controller = useRef<AbortController | null>(null);

  /** Abandon whatever is in flight, for a state change that leaves nothing to show. */
  const invalidate = useCallback(() => {
    latest.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  const begin = useCallback((): TrackedRequest => {
    invalidate();
    const id = latest.current;
    const abortController = new AbortController();
    controller.current = abortController;

    return { signal: abortController.signal, isCurrent: () => id === latest.current };
  }, [invalidate]);

  // Nothing should still be resolving against a component that is gone.
  useEffect(() => invalidate, [invalidate]);

  return { begin, invalidate };
};

export default useLatestRequest;
