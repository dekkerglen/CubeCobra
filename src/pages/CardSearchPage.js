import React from 'react';

import PropTypes from 'prop-types';

import CardSearch from 'components/CardSearch';
import RenderToRoot from 'components/RenderToRoot';
import { CubeContextProvider } from 'contexts/CubeContext';
import MainLayout from 'layouts/MainLayout';

const CardSearchPage = ({ loginCallback }) => {
  return (
    <CubeContextProvider initialCube={{ defaultSorts: [] }} cards={{ mainboard: [] }}>
      <MainLayout loginCallback={loginCallback}>
        <CardSearch />
      </MainLayout>
    </CubeContextProvider>
  );
};

CardSearchPage.propTypes = {
  loginCallback: PropTypes.string,
};

CardSearchPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CardSearchPage);
