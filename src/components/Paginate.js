import React from 'react';
import PropTypes from 'prop-types';

import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

const RealPage = ({ index, active, urlF, onClick }) => (
  <PaginationItem active={active === index}>
    <PaginationLink tag="a" href={urlF ? urlF(index) : '#'} data-index={onClick ? index : undefined} onClick={onClick}>
      {index + 1}
    </PaginationLink>
  </PaginationItem>
);

RealPage.propTypes = {
  index: PropTypes.number.isRequired,
  active: PropTypes.number.isRequired,
  urlF: PropTypes.func,
  onClick: PropTypes.func,
};

RealPage.defaultProps = {
  urlF: null,
  onClick: undefined,
};

const FakePage = ({ text }) => (
  <PaginationItem disabled>
    <PaginationLink tag="a">{text}</PaginationLink>
  </PaginationItem>
);

FakePage.propTypes = {
  text: PropTypes.string.isRequired,
};

const Paginate = ({ count, active, urlF, onClick }) => {
  const smallPagination = new Array(count).fill(null).map((page, index) => (
    // eslint-disable-next-line react/no-array-index-key
    <RealPage key={index} index={index} active={active} urlF={urlF} onClick={onClick} />
  ));

  const bigPagination = (
    <>
      {active > 1 && <RealPage index={0} active={active} urlF={urlF} onClick={onClick} />}
      {active > 2 && <FakePage text="..." />}
      {active !== 0 && <RealPage index={active - 1} active={active} urlF={urlF} onClick={onClick} />}
      <RealPage index={active} active={active} urlF={urlF} onClick={onClick} />
      {active !== count - 1 && <RealPage index={active + 1} active={active} urlF={urlF} onClick={onClick} />}
      {active < count - 3 && <FakePage text="..." />}
      {active < count - 2 && <RealPage index={count - 1} active={active} urlF={urlF} onClick={onClick} />}
    </>
  );

  return (
    <Pagination aria-label="Table page" className="mt-3">
      <PaginationItem disabled={active === 0}>
        <PaginationLink
          tag="a"
          previous
          href={urlF ? urlF(active - 1) : '#'}
          data-index={onClick ? active - 1 : undefined}
          onClick={onClick}
        />
      </PaginationItem>
      {count < 5 ? smallPagination : bigPagination}
      <PaginationItem disabled={active === count - 1}>
        <PaginationLink
          tag="a"
          next
          href={urlF ? urlF(active + 1) : '#'}
          data-index={onClick ? active + 1 : undefined}
          onClick={onClick}
        />
      </PaginationItem>
    </Pagination>
  );
};

Paginate.propTypes = {
  count: PropTypes.number.isRequired,
  active: PropTypes.number.isRequired,
  urlF: PropTypes.func,
  onClick: PropTypes.func,
};

Paginate.defaultProps = {
  urlF: null,
  onClick: undefined,
};

export default Paginate;
