import React, { ReactNode } from 'react';
import { Flexbox } from './Layout';
import Pagination from './Pagination';
import Table from './Table';

interface PagedTableProps {
  headers?: string[];
  rows: { [key: string]: ReactNode }[];
  pageSize?: number;
  children?: ReactNode;
  className?: string;
}

const PagedTable: React.FC<PagedTableProps> = ({ headers, pageSize = 10, rows, children, className }) => {
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
      <Table headers={headers} rows={rows.slice(page * pageSize, (page + 1) * pageSize)} />
    </Flexbox>
  );
};

export default PagedTable;
