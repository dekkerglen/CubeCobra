import { useState, useMemo } from 'react';

const useSortableData = (data, config = null, sortFns = {}) => {
  const [sortConfig, setSortConfig] = useState(config);

  const items = useMemo(() => {
    const sortableItems = [...data];
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const sortFn = sortFns[key] ?? ((a, b) => a - b);
      sortableItems.sort((a, b) => {
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

  const requestSort = (key) =>
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
