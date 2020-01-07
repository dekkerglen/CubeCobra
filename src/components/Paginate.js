/* eslint-disable react/jsx-filename-extension */
import React from 'react';

import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

const Paginate = ({ pages }) => {
  const activePage = pages.filter((page) => page.active)[0].content - 1;
  const cubeId = pages[activePage].url.split('/')[3];
  const pageLength = pages.length;

  const smallPagination = (
    <>
      {pages.map((page, idx) => (
        <PaginationItem active={page.active} key={idx}>
          <PaginationLink tag="a" href={page.url}>
            {page.content}
          </PaginationLink>
        </PaginationItem>
      ))}
    </>
  );

  const bigPagination = (
    <>
      {activePage > 1 ? (
        <>
          <PaginationItem key={1}>
            <PaginationLink tag="a" href={`/cube/blog/${cubeId}/0`}>
              1
            </PaginationLink>
          </PaginationItem>
        </>
      ) : (
        <></>
      )}
      {activePage > 2 ? (
        <>
          <PaginationItem disabled key="elips">
            <PaginationLink tag="a" href="#">
              ...
            </PaginationLink>
          </PaginationItem>
        </>
      ) : (
        <></>
      )}
      {activePage === 0 ? (
        <></>
      ) : (
        <PaginationItem key={activePage - 1}>
          <PaginationLink tag="a" href={`/cube/blog/${cubeId}/${activePage - 1}`}>
            {activePage}
          </PaginationLink>
        </PaginationItem>
      )}
      <PaginationItem active key={activePage}>
        <PaginationLink tag="a" href={`/cube/blog/${cubeId}/${activePage}`}>
          {activePage + 1}
        </PaginationLink>
      </PaginationItem>
      {activePage === pageLength - 1 ? (
        <></>
      ) : (
        <PaginationItem key={activePage + 1}>
          <PaginationLink tag="a" href={`/cube/blog/${cubeId}/${activePage + 1}`}>
            {activePage + 2}
          </PaginationLink>
        </PaginationItem>
      )}
      {activePage < pageLength - 3 ? (
        <>
          <PaginationItem disabled key="elips2">
            <PaginationLink tag="a" href="#">
              ...
            </PaginationLink>
          </PaginationItem>
        </>
      ) : (
        <></>
      )}
      {activePage < pageLength - 2 ? (
        <>
          <PaginationItem disabled={activePage === pageLength - 1} key={pageLength - 1}>
            <PaginationLink tag="a" href={`/cube/blog/${cubeId}/${pageLength - 1}`}>
              {pageLength}
            </PaginationLink>
          </PaginationItem>
        </>
      ) : (
        <></>
      )}
    </>
  );

  return (
    <>
      <hr />
      <Pagination aria-label="Table page" className="mt-3">
        <PaginationItem disabled={activePage == 0} key="first">
          <PaginationLink tag="a" previous href={`/cube/blog/${cubeId}/${activePage - 1}`} />
        </PaginationItem>
        {pageLength < 5 ? smallPagination : bigPagination}
        <PaginationItem disabled={activePage === pageLength - 1} key="last">
          <PaginationLink tag="a" next href={`/cube/blog/${cubeId}/${activePage + 1}`} />
        </PaginationItem>
      </Pagination>
      <hr />
    </>
  );
};

export default Paginate;
