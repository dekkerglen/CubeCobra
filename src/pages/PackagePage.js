import React from 'react';
import PropTypes from 'prop-types';
import CardPackagePropType from 'proptypes/CardPackagePropType';

import CardPackage from 'components/CardPackage';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

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
