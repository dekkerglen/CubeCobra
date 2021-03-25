import React from 'react';
import PropTypes from 'prop-types';

import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

const RealPage = ({ index, active, urlF, onClick }) => (
  <PaginationItem active={active === index}>
    <PaginationLink
      data-index={onClick ? index : undefined}
      onClick={() => onClick(index)}
      // the button tag needs to have a set type to not accidentally submit forms
      {...(urlF ? { tag: 'a', href: urlF(index) } : { tag: 'button', type: 'button' })}
    >
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
  urlF: undefined,
  onClick: () => {},
};

const FakePage = ({ text }) => (
  <PaginationItem disabled>
    <PaginationLink>{text}</PaginationLink>
  </PaginationItem>
);

FakePage.propTypes = {
  text: PropTypes.string.isRequired,
};

const range = (start, end) => {
  if (start === end) return [start];
  return [start, ...range(start + 1, end)];
};

const Paginate = ({ count, active, urlF, onClick }) => {
  const smallPagination = new Array(count).fill(null).map((page, index) => (
    // eslint-disable-next-line react/no-array-index-key
    <RealPage key={index} index={index} active={active} urlF={urlF} onClick={onClick} />
  ));

  const bigPagination = (
    <>
      <RealPage index={0} active={active} urlF={urlF} onClick={onClick} />
      {active < 4 && (
        <>
          {range(1, 4).map((index) => (
            // eslint-disable-next-line react/no-array-index-key
            <RealPage key={index} index={index} active={active} urlF={urlF} onClick={onClick} />
          ))}
          <FakePage text="..." />
        </>
      )}
      {active > count - 5 && (
        <>
          <FakePage text="..." />
          {range(count - 5, count - 2).map((index) => (
            // eslint-disable-next-line react/no-array-index-key
            <RealPage key={index} index={index} active={active} urlF={urlF} onClick={onClick} />
          ))}
        </>
      )}
      {active >= 4 && active <= count - 5 && (
        <>
          <FakePage text="..." />
          {range(active - 1, active + 1).map((index) => (
            // eslint-disable-next-line react/no-array-index-key
            <RealPage key={index} index={index} active={active} urlF={urlF} onClick={onClick} />
          ))}
          <FakePage text="..." />
        </>
      )}
      <RealPage index={count - 1} active={active} urlF={urlF} onClick={onClick} />
    </>
  );

  return (
    <Pagination aria-label="Table page" className="mt-3 pagination">
      <PaginationItem disabled={active === 0}>
        <PaginationLink
          previous
          data-index={onClick ? active - 1 : undefined}
          onClick={() => onClick(active - 1)}
          {...(urlF ? { tag: 'a', href: urlF(active - 1) } : { tag: 'button', type: 'button' })}
        />
      </PaginationItem>
      {count < 8 ? smallPagination : bigPagination}
      <PaginationItem disabled={active === count - 1}>
        <PaginationLink
          next
          data-index={onClick ? active + 1 : undefined}
          onClick={() => onClick(active + 1)}
          {...(urlF ? { tag: 'a', href: urlF(active + 1) } : { tag: 'button', type: 'button' })}
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
  urlF: undefined,
  onClick: () => {},
};

export default Paginate;
