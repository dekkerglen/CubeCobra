import React, { useState } from 'react';
import PropTypes from 'prop-types';

import Paginate from 'components/Paginate';

const PagedList = ({ pageSize, rows, showBottom, pageWrap }) => {
  const [page, setPage] = useState(0);

  const displayRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];

  const current = Math.min(page, validPages.length - 1);

  return (
    <>
      {validPages.length > 1 && <Paginate count={validPages.length} active={current} onClick={(i) => setPage(i)} />}
      {pageWrap(displayRows)}
      {showBottom && validPages.length > 1 && (
        <Paginate count={validPages.length} active={current} onClick={(i) => setPage(i)} />
      )}
    </>
  );
};

PagedList.propTypes = {
  pageSize: PropTypes.number,
  showBottom: PropTypes.bool,
  rows: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  pageWrap: PropTypes.func,
};

PagedList.defaultProps = {
  pageSize: 60,
  showBottom: false,
  pageWrap: (element) => element,
};

export default PagedList;
