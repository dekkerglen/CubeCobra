import React from 'react';
import Paginate from 'components/base/Pagination';
import useQueryParam from 'hooks/useQueryParam';
import { Flexbox } from './base/Layout';

interface PagedListProps {
  pageSize?: number;
  showBottom?: boolean;
  rows: any[];
  pageWrap?: (elements: any[]) => React.ReactNode;
  children?: React.ReactNode;
}

const PagedList: React.FC<PagedListProps> = ({ pageSize = 60, rows, showBottom = false, pageWrap, children }) => {
  const [page, setPage] = useQueryParam('page', '0');

  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];
  const current = Math.min(parseInt(`${page}`, 10), validPages.length - 1);
  const displayRows = rows.slice(current * pageSize, (current + 1) * pageSize);

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox justify="between" alignItems="end" className="mx-2 mt-2" gap="4">
        <div className="flex-grow">{children}</div>
        {validPages.length > 1 && (
          <Paginate count={validPages.length} active={current} onClick={(i) => setPage(`${i}`)} />
        )}
      </Flexbox>
      <div>{pageWrap ? pageWrap(displayRows) : displayRows}</div>
      {showBottom && validPages.length > 1 && (
        <Flexbox justify="end" className="mx-2 mb-2">
          <Paginate count={validPages.length} active={current} onClick={(i) => setPage(`${i}`)} />
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default PagedList;
