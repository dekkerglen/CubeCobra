import React, { useState } from 'react';
import PropTypes from 'prop-types';

import Paginate from 'components/Paginate';

import { Table } from 'reactstrap';

const PagedTable = ({ pageSize, rows, children, ...props }) => {
  const [page, setPage] = useState(0);

  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];
  const current = Math.min(page, validPages.length - 1);
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
    </>
  );
};

PagedTable.propTypes = {
  children: PropTypes.element.isRequired,
  pageSize: PropTypes.number,
  showBottom: PropTypes.bool,
  rows: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  pageWrap: PropTypes.func,
};

PagedTable.defaultProps = {
  pageSize: 60,
  showBottom: false,
  pageWrap: (element) => element,
};

export default PagedTable;
