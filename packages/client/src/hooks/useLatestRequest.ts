import { useCallback, useEffect, useRef } from 'react';

export interface TrackedRequest {
  signal: AbortSignal;
  isCurrent: () => boolean;
}

// Guard every response (including catch/finally) with isCurrent(), since responses can arrive out of order.
const useLatestRequest = () => {
  const latest = useRef(0);
  const controller = useRef<AbortController | null>(null);

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

  useEffect(() => invalidate, [invalidate]);

  return { begin, invalidate };
};

export default useLatestRequest;
