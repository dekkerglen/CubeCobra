import { useEffect, useState } from 'react';

/** Whether a CSS media query currently matches, e.g. useMediaQuery('(max-width: 767px)'). */
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
};

export default useMediaQuery;
