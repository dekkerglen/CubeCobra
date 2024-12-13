import React from 'react';

import Paginate from 'components/base/Pagination';
import useQueryParam from 'hooks/useQueryParam';
import Table, { TableProps } from './base/Table';
import { Flexbox } from './base/Layout';

interface PagedTableProps extends TableProps {
  pageSize: number;
}

const PagedTable: React.FC<PagedTableProps> = ({ pageSize, rows, headers }) => {
  const [page, setPage] = useQueryParam('page', '0');

  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];
  const current = Math.min(parseInt(page, 10), validPages.length - 1);
  const displayRows = rows.slice(current * pageSize, (current + 1) * pageSize);

  return (
    <Flexbox direction="col" className="w-full" gap="2">
      {validPages.length > 1 && (
        <Paginate count={validPages.length} active={current} onClick={(i) => setPage(`${i}`)} />
      )}
      <Table headers={headers} rows={displayRows} />
      {validPages.length > 1 && (
        <Paginate count={validPages.length} active={current} onClick={(i) => setPage(`${i}`)} />
      )}
    </Flexbox>
  );
};

export default PagedTable;
