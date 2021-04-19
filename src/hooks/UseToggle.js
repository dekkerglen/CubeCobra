import { useCallback, useState } from 'react';

const useToggle = (def) => {
  const [value, setValue] = useState(def);
  const toggle = useCallback(() => setValue((val) => !val), [setValue]);
  const enable = useCallback(() => setValue(true), [setValue]);
  const disable = useCallback(() => setValue(false), [setValue]);
  return [value, toggle, enable, disable];
};

export default useToggle;
