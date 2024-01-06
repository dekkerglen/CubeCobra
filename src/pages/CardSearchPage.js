import React from 'react';
import PropTypes from 'prop-types';

import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import { CubeContextProvider } from 'contexts/CubeContext';
import CardSearch from 'components/CardSearch';

function CardSearchPage({ loginCallback }) {
  return (
    <CubeContextProvider initialCube={{ defaultSorts: [] }} cards={{ mainboard: [] }}>
      <MainLayout loginCallback={loginCallback}>
        <CardSearch />
      </MainLayout>
    </CubeContextProvider>
  );
}

CardSearchPage.propTypes = {
  loginCallback: PropTypes.string,
};

CardSearchPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CardSearchPage);
