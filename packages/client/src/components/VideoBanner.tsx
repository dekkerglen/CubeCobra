import React, { useContext } from 'react';

import { isAdFree } from '@utils/adsUtil';

import UserContext from '../contexts/UserContext';
import Advertisment from './Advertisment';

interface MobileBannerProps {
  placementId: string;
}

const VideoBanner: React.FC<MobileBannerProps> = ({ placementId }) => {
  const user = useContext(UserContext);

  if (isAdFree(user?.roles)) return <></>;
  return (
    <Advertisment
      placementId={placementId}
      size="video"
      media="desktop"
      format="floating"
      refreshTime={30}
      position="fixed-bottom-left"
    />
  );
};

export default VideoBanner;
