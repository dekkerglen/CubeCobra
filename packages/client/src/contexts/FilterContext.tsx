import React, { createContext, useEffect, useMemo, useState } from 'react';

import { defaultFilter, FilterFunction, makeFilter } from '@utils/filtering/FilterCards';
import useQueryParam from '../hooks/useQueryParam';

export interface FilterContextValue {
  filterInput: string | null;
  setFilterInput: (value: string) => void;
  filterValid: boolean;
  cardFilter: { filter: FilterFunction };
}

const FilterContext = createContext<FilterContextValue>({
  filterInput: null,
  setFilterInput: function (): void {
    throw new Error('Function not implemented.');
  },
  filterValid: false,
  cardFilter: {
    filter: defaultFilter(),
  },
});

interface FilterContextProviderProps {
  children: React.ReactNode;
}

export const FilterContextProvider: React.FC<FilterContextProviderProps> = ({ children }) => {
  const [filterInput, setFilterInput] = useQueryParam('f', '');
  const [filterValid, setFilterValid] = useState(true);
  const [cardFilter, setCardFilter] = useState<{ filter: FilterFunction }>({ filter: defaultFilter() });

  useEffect(
    (overrideFilter?: string) => {
      const input = overrideFilter ?? filterInput ?? '';
      if (input.trim() === '') {
        setCardFilter({ filter: defaultFilter() });
        return;
      }

      const { filter, err } = makeFilter(input);
      if (err || !filter) {
        setFilterValid(false);
        return;
      }

      setFilterValid(true);
      setCardFilter({ filter });
    },
    [filterInput, setCardFilter],
  );

  const value = useMemo(
    () => ({
      filterInput,
      setFilterInput,
      filterValid,
      cardFilter,
    }),
    [filterInput, setFilterInput, filterValid, cardFilter],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export default FilterContext;
