import React from 'react';

import PropTypes from 'prop-types';

import CardSearch from 'components/CardSearch';
import { CubeContextProvider } from 'contexts/CubeContext';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

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
