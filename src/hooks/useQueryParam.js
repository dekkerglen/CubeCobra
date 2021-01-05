import { useEffect, useRef, useState } from 'react';

import Query from 'utils/Query';

const useQueryParam = (name, defaultValue) => {
  const didMountRef = useRef(false);
  const [value, setValue] = useState(defaultValue ?? null);

  useEffect(() => {
    if (didMountRef.current) {
      if (value !== null) {
        Query.set(name, value);
      } else {
        Query.del(value);
      }
    } else {
      const queryFormat = Query.get(name);
      if (queryFormat !== null || queryFormat !== undefined) {
        setValue(queryFormat);
      } else if ((defaultValue ?? null) === null) {
        setValue(null);
      }
      didMountRef.current = true;
    }
  }, [name, value, setValue, defaultValue]);
  return [value, setValue];
};

export default useQueryParam;
