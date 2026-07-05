import React, { useContext } from 'react';

import { isAdFree } from '@utils/adsUtil';

import UserContext from '../contexts/UserContext';
import Advertisment from './Advertisment';

interface SideBannerProps {
  placementId: string;
}

const SideBanner: React.FC<SideBannerProps> = ({ placementId }) => {
  const user = useContext(UserContext);

  if (isAdFree(user?.roles)) return null;
  return <Advertisment placementId={placementId} size="side" media="desktop" format="sticky-stack" />;
};

export default SideBanner;
