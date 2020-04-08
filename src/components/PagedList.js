import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

const PageLink = ({ pageIndex, active, setPage }) => {
  return (
    <PaginationItem key={pageIndex} active={active}>
      <PaginationLink
        tag="a"
        href="#"
        page={pageIndex}
        onClick={(event) => {
          event.preventDefault();
          setPage(pageIndex);
        }}
      >
        {pageIndex + 1}
      </PaginationLink>
    </PaginationItem>
  );
};

PageLink.propTypes = {
  pageIndex: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
  setPage: PropTypes.func.isRequired,
};

const FakePage = ({ text }) => (
  <PaginationItem disabled>
    <PaginationLink tag="a">{text}</PaginationLink>
  </PaginationItem>
);

FakePage.propTypes = {
  text: PropTypes.string.isRequired,
};

const PaginationLabels = ({ validPages, page, setPage }) => {
  if (validPages.length <= 1) {
    return <></>;
  }
  if (validPages.length <= 5) {
    return (
      <Pagination aria-label="Table page" className="my-2 justify-content-center">
        {validPages.map((pageIndex) => (
          <PageLink pageIndex={pageIndex} setPage={setPage} active={pageIndex === page} />
        ))}
      </Pagination>
    );
  }

  const count = validPages.length;
  return (
    <Pagination aria-label="Table page" className="my-2">
      <PaginationItem disabled={page === 0}>
        <PaginationLink tag="a" previous onClick={() => setPage(page - 1)} />
      </PaginationItem>
      {page > 1 && <PageLink pageIndex={0} setPage={setPage} active={false} />}
      {page > 2 && <FakePage text="..." />}
      {page !== 0 && <PageLink pageIndex={page - 1} setPage={setPage} active={false} />}
      <PageLink pageIndex={page} setPage={setPage} active />
      {page !== count - 1 && <PageLink pageIndex={page + 1} setPage={setPage} active={false} />}
      {page < count - 3 && <FakePage text="..." />}
      {page < count - 2 && <PageLink pageIndex={count - 1} setPage={setPage} active={false} />}
      <PaginationItem disabled={page === count - 1}>
        <PaginationLink tag="a" next onClick={() => setPage(page + 1)} />
      </PaginationItem>
    </Pagination>
  );
};

PaginationLabels.propTypes = {
  page: PropTypes.number.isRequired,
  setPage: PropTypes.func.isRequired,
  validPages: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

const PagedList = ({ pageSize, rows, showBottom, pageWrap }) => {
  const [page, setPage] = useState(0);

  const displayRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];

  const current = Math.min(page, validPages.length - 1);

  return (
    <>
      <PaginationLabels validPages={validPages} page={current} setPage={setPage} />
      {pageWrap(displayRows)}
      {showBottom && <PaginationLabels validPages={validPages} page={current} setPage={setPage} />}
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
