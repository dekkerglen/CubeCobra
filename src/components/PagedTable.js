import React from 'react';
import PropTypes from 'prop-types';

import { Table } from 'reactstrap';

import Paginate from 'components/Paginate';
import useQueryParam from 'hooks/useQueryParam';

const PagedTable = ({ pageSize, rows, children, ...props }) => {
  const [page, setPage] = useQueryParam('page', '0');

  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];
  const current = Math.min(parseInt(page, 10), validPages.length - 1);
  const displayRows = rows.slice(current * pageSize, (current + 1) * pageSize);

  return (
    <>
      {validPages.length > 1 && <Paginate count={validPages.length} active={current} onClick={(i) => setPage(i)} />}
      <div className="table-responsive">
        <Table {...props}>
          {children}
          <tbody>{displayRows}</tbody>
        </Table>
      </div>
      {validPages.length > 1 && <Paginate count={validPages.length} active={current} onClick={(i) => setPage(i)} />}
    </>
  );
};

PagedTable.propTypes = {
  children: PropTypes.element.isRequired,
  pageSize: PropTypes.number,
  rows: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

PagedTable.defaultProps = {
  pageSize: 60,
};

export default PagedTable;
