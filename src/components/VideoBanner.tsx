import React, { useContext } from 'react';
import Advertisment from 'components/Advertisment';
import UserContext from 'contexts/UserContext';

interface MobileBannerProps {
  placementId: string;
}

const VideoBanner: React.FC<MobileBannerProps> = ({ placementId }) => {
  const user = useContext(UserContext);

  if (user && Array.isArray(user.roles) && user.roles.includes('Patron')) return <></>;
  return <Advertisment placementId={placementId} size="video" media="desktop" format="floating" refreshTime={30} />;
};

export default VideoBanner;
