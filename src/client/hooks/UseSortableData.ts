import { Dispatch, SetStateAction, useMemo, useState } from 'react';

export const SortDirections: string[] = ['ascending', 'descending'];
export type SortDirectionsType = (typeof SortDirections)[number];

export interface SortConfig {
  key: string;
  direction: SortDirectionsType;
}

interface SortFns {
  [key: string]: (a: any, b: any) => number;
}

const useSortableData = <T extends Record<string, any>>(
  data: T[],
  config: SortConfig | null = null,
  sortFns: SortFns = {},
): {
  items: T[];
  requestSort: (key: string) => void;
  sortConfig: SortConfig | null;
} => {
  const [sortConfig, setSortConfig]: [SortConfig | null, Dispatch<SetStateAction<SortConfig | null>>] =
    useState(config);

  const items = useMemo(() => {
    const sortableItems = [...data];
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const sortFn = sortFns[key] ?? ((a, b) => a - b);
      sortableItems.sort((a: T, b: T) => {
        const ordering = sortFn(a[key], b[key]);
        if (ordering < 0) {
          return direction === 'ascending' ? -1 : 1;
        }
        if (ordering > 0) {
          return direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig, sortFns]);

  const requestSort = (key: string) =>
    setSortConfig((current) => {
      if (current && current.key === key) {
        if (current.direction === 'descending') {
          return { key, direction: 'ascending' };
        }
        if (current.direction === 'ascending') {
          return null;
        }
      }
      return { key, direction: 'descending' };
    });

  return { items, requestSort, sortConfig };
};

export default useSortableData;
