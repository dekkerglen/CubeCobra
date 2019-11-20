import React, { useState } from 'react';

import PagedTable from './PagedTable';

const SortableTable = ({ sorts, defaultSort, headers, data, rowF }) => {
  const [sort, setSort] = useState(defaultSort);
  const sortKeyF = sorts[sort];
  if (sortKeyF) {
    data.sort((x, y) => sortKeyF(x) - sortKeyF(y));
  }
  const rows = data.map(rowF).flat();
  return (
    <PagedTable rows={rows}>
      <thead>
        <tr>
          {[...Object.keys(headers)].map((header) => {
            const sortable = !!sorts[header];
            if (sortable) {
              return (
                <th
                  key={header}
                  onClick={() => setSort(header)}
                  scope="col"
                  {...headers[header]}
                  style={{ cursor: 'pointer', ...headers[header].style }}
                >
                  {header}
                  {sort === header ? ' ▼' : ''}
                </th>
              );
            } else {
              return <th key={header}>{header}</th>;
            }
          })}
        </tr>
      </thead>
    </PagedTable>
  );
};

export default SortableTable;
