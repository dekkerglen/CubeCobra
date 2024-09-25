import React from 'react';

import PropTypes from 'prop-types';
import CardPackagePropType from 'proptypes/CardPackagePropType';

import Banner from 'components/Banner';
import CardPackage from 'components/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const PackagePage = ({ pack, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <CardPackage cardPackage={pack} refresh={() => window.location.reload()} />
  </MainLayout>
);

PackagePage.propTypes = {
  pack: CardPackagePropType.isRequired,
  loginCallback: PropTypes.string,
};

PackagePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(PackagePage);
