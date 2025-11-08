import React, { useContext } from 'react';

import { UserRoles } from '@utils/datatypes/User';
import UserContext from '../contexts/UserContext';
import Advertisment from './Advertisment';

interface MobileBannerProps {
  placementId: string;
}

const MobileBanner: React.FC<MobileBannerProps> = ({ placementId }) => {
  const user = useContext(UserContext);

  if (user && Array.isArray(user.roles) && user.roles.includes(UserRoles.PATRON)) return <></>;
  return <Advertisment placementId={placementId} size="mobile" media="mobile" format="anchor" />;
};

export default MobileBanner;
