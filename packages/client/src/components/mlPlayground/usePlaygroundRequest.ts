import { useCallback, useContext, useState } from 'react';

import { CSRFContext } from 'contexts/CSRFContext';
import useLatestRequest from 'hooks/useLatestRequest';

import { PlaygroundError } from './types';

export type PlaygroundEndpoint = 'recommend' | 'draft' | 'deckbuild' | 'archetype';

export type PlaygroundResult<T> = { data: T; error: null } | { data: null; error: PlaygroundError };

const errorFor = (status: number, json: any): PlaygroundError => {
  if (json?.mlUnavailable || status === 503) {
    return { kind: 'ml-unavailable', message: json?.message ?? 'The card recommender is temporarily unavailable.' };
  }
  if (status === 429) {
    return { kind: 'rate-limited', message: json?.message ?? 'Too many requests. Please wait a moment and try again.' };
  }
  if (status === 400 && json?.message) {
    return { kind: 'invalid', message: json.message };
  }
  // Shown under a "Something went wrong" heading, so the server's own wording would repeat it.
  return { kind: 'generic', message: 'Please try again.' };
};

/** POSTs to one ML Playground endpoint. Returns null when a newer call superseded this one. */
export const usePlaygroundFetch = () => {
  const { csrfFetch } = useContext(CSRFContext);

  return useCallback(
    async <T>(
      endpoint: PlaygroundEndpoint,
      body: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<PlaygroundResult<T>> => {
      try {
        const response = await csrfFetch(`/tool/api/mlplayground/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.success) {
          return { data: null, error: errorFor(response.status, json) };
        }
        return { data: json as T, error: null };
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        return { data: null, error: { kind: 'generic', message: 'Please try again.' } };
      }
    },
    [csrfFetch],
  );
};

/**
 * One request at a time against a playground endpoint: a new run supersedes the one in flight,
 * and only the latest run's answer lands in state.
 */
const usePlaygroundRequest = <T>(endpoint: PlaygroundEndpoint) => {
  const post = usePlaygroundFetch();
  const { begin } = useLatestRequest();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<PlaygroundError | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (body: Record<string, unknown>): Promise<T | null> => {
      const request = begin();
      setLoading(true);
      setError(null);
      try {
        const result = await post<T>(endpoint, body, request.signal);
        if (!request.isCurrent()) return null;
        if (result.error) {
          setError(result.error);
          return null;
        }
        setData(result.data);
        return result.data;
      } catch {
        return null;
      } finally {
        if (request.isCurrent()) setLoading(false);
      }
    },
    [begin, endpoint, post],
  );

  return { data, setData, error, setError, loading, run };
};

export default usePlaygroundRequest;
