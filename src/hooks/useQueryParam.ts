import { useEffect, useRef, useState } from 'react';

import Query from 'utils/Query';

const useQueryParam = (
  name: string,
  defaultValue: string | null,
): [string | null, React.Dispatch<React.SetStateAction<string | null>>] => {
  const didMountRef = useRef(false);
  const [value, setValue] = useState<string | null>(defaultValue ?? null);

  useEffect(() => {
    if (didMountRef.current) {
      if ((value ?? null) !== null && value !== defaultValue) {
        Query.set(name, value as string);
      } else {
        Query.del(name);
      }
    } else {
      const query = Query.get(name, defaultValue as string);
      if ((query ?? null) !== null) {
        setValue(query as string);
      } else {
        setValue(defaultValue ?? null);
      }
      didMountRef.current = true;
    }
  }, [name, value, setValue, defaultValue]);
  return [value, setValue];
};

export default useQueryParam;
