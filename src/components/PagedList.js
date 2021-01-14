import PropTypes from 'prop-types';

import Paginate from 'components/Paginate';
import useQueryParam from 'hooks/useQueryParam';

const PagedList = ({ pageSize, rows, showBottom, pageWrap }) => {
  const [page, setPage] = useQueryParam('page', 0);

  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];
  const current = Math.min(parseInt(page, 10), validPages.length - 1);
  const displayRows = rows.slice(current * pageSize, (current + 1) * pageSize);

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
