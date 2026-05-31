// Fetchers for AutocompleteInput. Each returns the top-N matches for a query
// from a server endpoint; the card-name catalog never ships to the browser.

import Image from '@utils/datatypes/Image';

export type MatchFetcher = (query: string, signal?: AbortSignal) => Promise<string[]>;

const getJson = async (url: string, signal?: AbortSignal): Promise<any | null> => {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    // eslint-disable-next-line no-console
    console.error('autocomplete fetch failed', err);
    return null;
  }
};

// Global card-name autocomplete. `full` switches between bare names and
// name-with-set strings (printing-specific suggestions).
export const cardNameMatches =
  (full: boolean = false, includeExtras: boolean = false): MatchFetcher =>
  async (query, signal) => {
    const json = await getJson(
      `/tool/api/cardnames?q=${encodeURIComponent(query)}&full=${full ? '1' : '0'}&extras=${includeExtras ? '1' : '0'}`,
      signal,
    );
    return json?.success === 'true' ? json.names : [];
  };

// Card names restricted to one board of one cube.
export const cubeCardNameMatches =
  (cubeId: string, board: string): MatchFetcher =>
  async (query, signal) => {
    const json = await getJson(
      `/cube/api/cubecardnames/${cubeId}/${board}?q=${encodeURIComponent(query)}`,
      signal,
    );
    return json?.success === 'true' ? json.cardnames : [];
  };

// Tag autocomplete scoped to a cube.
export const cubeCardTagMatches =
  (cubeId: string): MatchFetcher =>
  async (query, signal) => {
    const json = await getJson(`/cube/api/cubecardtags/${cubeId}?q=${encodeURIComponent(query)}`, signal);
    return json?.success === 'true' ? json.tags : [];
  };

// Resolves one card name → its art (uri/artist/id). Replaces imagedict.json
// (~28MB) that pages used to download whole just to look up a single card.
// Returns null when there is no real match.
export const fetchCardImage = async (name: string, signal?: AbortSignal): Promise<Image | null> => {
  if (!name) return null;
  const json = await getJson(`/tool/api/cardimagedata?name=${encodeURIComponent(name)}`, signal);
  return json?.success === 'true' ? (json.image as Image | null) : null;
};
