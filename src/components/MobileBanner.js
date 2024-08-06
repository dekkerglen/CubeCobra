import React, { useContext } from 'react';

import PropTypes from 'prop-types';

import Advertisment from 'components/Advertisment';
import UserContext from 'contexts/UserContext';

const MobileBanner = ({ placementId }) => {
  const user = useContext(UserContext);

  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;
  return <Advertisment placementId={placementId} size="mobile" media="mobile" demo format="anchor" />;
};

MobileBanner.propTypes = {
  placementId: PropTypes.string.isRequired,
};

export default MobileBanner;
