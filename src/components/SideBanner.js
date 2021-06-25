import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import UserContext from 'contexts/UserContext';
import ResponsiveAd from 'components/ResponsiveAd';

const SideBanner = ({ placementId }) => {
  const user = useContext(UserContext);

  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;
  return <ResponsiveAd placementId={placementId} size="side" media="desktop" format="sticky-stack" />;
};

SideBanner.propTypes = {
  placementId: PropTypes.string.isRequired,
};

export default SideBanner;
