import { useContext } from 'react';

import { canUseImageHostingClient } from '@utils/hostedImagesUtil';

import UserContext from 'contexts/UserContext';

// True if the current user may upload/host images (active Lotus Cobra patron, or Admin).
const useCanUploadImages = (): boolean => {
  const user = useContext(UserContext);
  return canUseImageHostingClient(user?.patronLevel, user?.patronStatus, user?.roles);
};

export default useCanUploadImages;
