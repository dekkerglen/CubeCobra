import { useCallback, useState } from 'react';

const useToggle = (def) => {
  const [value, setValue] = useState(def);
  const toggle = useCallback(() => setValue(val => !val), []);
  const enable = useCallback(() => setValue(true), []);
  const disable = useCallback(() => setValue(false), []);
  return [value, toggle, enable, disable];
};

export default useToggle;