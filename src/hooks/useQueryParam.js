import { useEffect, useRef, useState } from 'react';

import Query from 'utils/Query';

const useQueryParam = (name, defaultValue) => {
  const didMountRef = useRef(false);
  const [value, setValue] = useState(defaultValue ?? null);

  useEffect(() => {
    if (didMountRef.current) {
      if ((value ?? null) !== null && value !== defaultValue) {
        Query.set(name, value);
      } else {
        Query.del(name);
      }
    } else {
      const query = Query.get(name);
      if ((query ?? null) !== null) {
        setValue(query);
      } else {
        setValue(defaultValue ?? null);
      }
      didMountRef.current = true;
    }
  }, [name, value, setValue, defaultValue]);
  return [value, setValue];
};

export default useQueryParam;
