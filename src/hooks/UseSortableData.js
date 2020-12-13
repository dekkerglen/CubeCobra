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

  const requestSort = (key) => {
    let direction = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  return { items, requestSort, sortConfig };
};

export default useSortableData;
