import { useEffect } from 'react';

/* A selection can come from a query param, saved cube state, or a list that just changed shape,
 * so it may name an option that is no longer offered. Fall back to the first option rather than
 * leaving the control blank while a different value is used downstream.
 */
const useCoercedSelection = (options: { value: string }[], value: string, setValue: (value: string) => void): void => {
  useEffect(() => {
    const firstOption = options[0];
    if (firstOption && !options.some((option) => option.value === value)) {
      setValue(firstOption.value);
    }
  }, [options, value, setValue]);
};

export default useCoercedSelection;
