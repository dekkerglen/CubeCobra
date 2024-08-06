import React from 'react';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import CubeHistory from 'components/CubeHistory';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

const CubeHistoryPage = ({ cube, changes, lastKey, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <DisplayContextProvider cubeID={cube.id}>
      <CubeLayout cube={cube} activeLink="history">
        <CubeHistory changes={changes} lastKey={lastKey} />
      </CubeLayout>
    </DisplayContextProvider>
  </MainLayout>
);

CubeHistoryPage.propTypes = {
  cube: CubePropType.isRequired,
  changes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string,
  loginCallback: PropTypes.string,
};

CubeHistoryPage.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(CubeHistoryPage);
