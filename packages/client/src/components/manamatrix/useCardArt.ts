import { useEffect, useState } from 'react';

import { fetchCardImage } from 'utils/cardAutocomplete';

// Art lookups are stable per card name; cache them so revisiting a completed
// board (or rendering it in the archive) doesn't refire identical requests.
const artCache = new Map<string, string | null>();

/** Best-effort art crop URL for a card name (cached); null on miss. */
export const getCardArtUrl = async (name: string, signal?: AbortSignal): Promise<string | null> => {
  if (!name) {
    return null;
  }
  if (artCache.has(name)) {
    return artCache.get(name) ?? null;
  }

  const image = await fetchCardImage(name, signal);
  const uri = image?.uri ?? null;
  artCache.set(name, uri);
  return uri;
};

/** Best-effort art crop URL for a card name; null while loading or on miss. */
const useCardArt = (name: string): string | null => {
  const [artUrl, setArtUrl] = useState<string | null>(() => (name && artCache.get(name)) || null);

  useEffect(() => {
    if (!name) {
      setArtUrl(null);
      return;
    }

    const controller = new AbortController();
    getCardArtUrl(name, controller.signal)
      .then((uri) => {
        if (!controller.signal.aborted) {
          setArtUrl(uri);
        }
      })
      .catch(() => setArtUrl(null));

    return () => controller.abort();
  }, [name]);

  return artUrl;
};

export default useCardArt;
