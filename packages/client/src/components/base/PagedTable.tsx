import React, { ReactNode } from 'react';

import { Flexbox } from './Layout';
import Pagination from './Pagination';
import Table, { TableProps } from './Table';

interface PagedTableProps {
  headers?: string[];
  rows: { [key: string]: ReactNode }[];
  pageSize?: number;
  children?: ReactNode;
  className?: string;
  // Same as Table's, but the index is into the full `rows`, not the current page.
  getRowProps?: TableProps['getRowProps'];
}

const PagedTable: React.FC<PagedTableProps> = ({ headers, pageSize = 10, rows, children, className, getRowProps }) => {
  const [page, setPage] = React.useState(0);

  return (
    <Flexbox direction="col">
      {children ? (
        <Flexbox direction="row" justify="between" className={className}>
          {children}
          <Pagination count={Math.ceil(rows.length / pageSize)} active={page} onClick={(p) => setPage(p)} />
        </Flexbox>
      ) : (
        <Flexbox direction="row" justify="end" className={className}>
          <Pagination count={Math.ceil(rows.length / pageSize)} active={page} onClick={(p) => setPage(p)} />
        </Flexbox>
      )}
      <Table
        headers={headers}
        rows={rows.slice(page * pageSize, (page + 1) * pageSize)}
        getRowProps={getRowProps ? (rowIndex) => getRowProps(page * pageSize + rowIndex) : undefined}
      />
    </Flexbox>
  );
};

export default PagedTable;
