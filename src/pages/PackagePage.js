import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';
import CardPackagePropType from 'proptypes/CardPackagePropType';

import CardPackage from 'components/CardPackage';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const PackagePage = ({ pack, user, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <CardPackage cardPackage={pack} user={user} refresh={() => window.location.reload()} />
  </MainLayout>
);

PackagePage.propTypes = {
  pack: CardPackagePropType.isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

PackagePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(PackagePage);
