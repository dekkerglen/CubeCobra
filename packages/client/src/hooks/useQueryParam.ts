import { useEffect, useRef, useState } from 'react';

import Query from '../utils/Query';

const useQueryParam = (name: string, defaultValue: string): [string, React.Dispatch<React.SetStateAction<string>>] => {
  const didMountRef = useRef(false);
  const [value, setValue] = useState<string>(defaultValue);

  // Sync state -> URL. On mount, seed from the URL. On subsequent user-driven
  // changes, push a new history entry (only when the value actually differs from
  // what's already in the URL) so browser back/forward can restore prior values.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      const query = Query.get(name, defaultValue as string);
      if ((query ?? null) !== null && query !== value) {
        setValue(query as string);
      }
      return;
    }

    const desired = (value ?? null) !== null && value !== defaultValue ? (value as string) : null;
    const current = Query.get(name);
    if (desired === current) {
      // Already in sync (mount echo, popstate re-sync, or a no-op change).
      return;
    }
    if (desired === null) {
      Query.del(name, true);
    } else {
      Query.set(name, desired, true);
    }
  }, [name, value, setValue, defaultValue]);

  // Re-read the URL on browser back/forward so the restored query drives state.
  useEffect(() => {
    const onPopState = () => {
      const query = Query.get(name, defaultValue as string);
      setValue((query ?? null) !== null ? (query as string) : (defaultValue ?? ''));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [name, defaultValue]);

  return [value, setValue];
};

export default useQueryParam;
