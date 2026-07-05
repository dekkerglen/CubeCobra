import React, { useContext } from 'react';

import { isAdFree } from '@utils/adsUtil';

import UserContext from '../contexts/UserContext';
import Advertisment from './Advertisment';

interface MobileBannerProps {
  placementId: string;
}

const MobileBanner: React.FC<MobileBannerProps> = ({ placementId }) => {
  const user = useContext(UserContext);

  if (isAdFree(user?.roles)) return <></>;
  return <Advertisment placementId={placementId} size="mobile" media="mobile" format="anchor" />;
};

export default MobileBanner;
