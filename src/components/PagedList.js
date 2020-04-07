import React, { useState } from 'react';

import { Pagination, PaginationItem, PaginationLink, Table } from 'reactstrap';

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

const FakePage = ({ text }) => (
  <PaginationItem disabled>
    <PaginationLink tag="a">{text}</PaginationLink>
  </PaginationItem>
);

const PaginationLabels = ({ validPages, page, setPage }) => {
  if (validPages.length <= 1) {
    return <></>;
  }
  if (validPages.length <= 5) {
    return (
      <Pagination aria-label="Table page" className="mt-3">
        {validPages.map((pageIndex) => (
          <PageLink pageIndex={pageIndex} setPage={setPage} active={pageIndex === page} />
        ))}
      </Pagination>
    );
  }

  const count = validPages.length;
  return (
    <Pagination aria-label="Table page" className="mt-3">
      {page > 1 && <PageLink pageIndex={0} setPage={setPage} active={false} />}
      {page > 2 && <FakePage text="..." />}
      {page !== 0 && <PageLink pageIndex={page - 1} setPage={setPage} active={false} />}
      <PageLink pageIndex={page} setPage={setPage} active />
      {page !== count - 1 && <PageLink pageIndex={page + 1} setPage={setPage} active={false} />}
      {page < count - 3 && <FakePage text="..." />}
      {page < count - 2 && <PageLink pageIndex={count - 1} setPage={setPage} active={false} />}
    </Pagination>
  );
};

const PagedList = ({ pageSize, rows }) => {
  const [page, setPage] = useState(0);

  const displayRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const validPages = [...Array(Math.ceil(rows.length / pageSize)).keys()];

  return (
    <>
      <PaginationLabels validPages={validPages} page={page} setPage={setPage} />
      {displayRows}
    </>
  );
};

PagedList.defaultProps = {
  pageSize: 60,
};

export default PagedList;
