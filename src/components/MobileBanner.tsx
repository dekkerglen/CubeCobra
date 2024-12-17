import React, { useContext } from 'react';
import Advertisment from 'components/Advertisment';
import UserContext from 'contexts/UserContext';

interface MobileBannerProps {
  placementId: string;
}

const MobileBanner: React.FC<MobileBannerProps> = ({ placementId }) => {
  const user = useContext(UserContext);

  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;
  return <Advertisment placementId={placementId} size="mobile" media="mobile" format="anchor" />;
};

export default MobileBanner;
