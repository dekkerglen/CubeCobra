import React, { useState } from 'react';
import { Button, CardBody, Input, Navbar } from 'reactstrap';

import PropTypes from 'prop-types';

import Banner from 'components/Banner';

const CubeSearchNavBar = ({ query, order, title, ascending }) => {
  const [queryText, setQuery] = useState(query || '');
  const [searchOrder, setSearchIndex] = useState(order || 'pop');
  const [searchAscending, setSearchAscending] = useState(ascending || false);

  const searchOptions = [
    ['Popularity', 'pop'],
    ['Alphabetical', 'alpha'],
    ['Card Count', 'cards'],
  ];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (queryText && queryText.length > 0) {
      window.location.href = `/search/${encodeURIComponent(
        queryText,
      )}?order=${searchOrder}&ascending=${searchAscending}`;
    } else {
      window.location.href = `/search`;
    }
  };

  return (
    <div className="usercontrols">
      <Banner />
      {title && (
        <CardBody className="pb-0">
          <h3>{title}</h3>
        </CardBody>
      )}
      <form onSubmit={handleSubmit}>
        <Navbar expand="md" className="navbar-light">
          <Input
            className="form-control me-sm-2"
            type="search"
            placeholder="Search cubes..."
            aria-label="Search"
            value={queryText}
            onChange={(event) => setQuery(event.target.value)}
          />
          <h6 className="noBreak me-2 pt-2">Sorted by:</h6>
          <Input type="select" id="viewSelect" value={searchOrder} onChange={(e) => setSearchIndex(e.target.value)}>
            {searchOptions.map((search) => (
              <option key={search[1]} value={search[1]}>
                {search[0]}
              </option>
            ))}
          </Input>
          <Input
            type="select"
            id="orderSelect"
            value={searchAscending}
            onChange={(e) => setSearchAscending(e.target.value)}
          >
            <option value="true">Ascending</option>
            <option value="false">Descending</option>
          </Input>
          <Button color="accent" className="mx-2">
            Search
          </Button>
        </Navbar>
      </form>
    </div>
  );
};

CubeSearchNavBar.propTypes = {
  query: PropTypes.string,
  order: PropTypes.string,
  title: PropTypes.string,
  ascending: PropTypes.bool,
};

CubeSearchNavBar.defaultProps = {
  title: null,
  query: '',
  order: 'pop',
  ascending: false,
};

export default CubeSearchNavBar;
