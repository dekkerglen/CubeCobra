import React from 'react';

import CubeSearchNavBar from 'components/CubeSearchNavBar';

const SearchPage = ({ cubes, query }) => {
  console.log(query);
  return (
    <>
      <CubeSearchNavBar query={query} />
      <br />
      {cubes && cubes.length > 0 ? <h4>Cubes</h4> : <h4>No Results</h4>}
    </>
  );
};

export default SearchPage;
