import React, { useContext } from 'react';

import AdsContext from '../contexts/AdsContext';
import useMount from '../hooks/UseMount';

interface MediaTypes {
  desktop: string;
  mobile: string;
  tablet: string;
}

interface SizeTypes {
  banner: [string, string][];
  side: [string, string][];
  mobile: [string, string][];
  video: [string, string][];
}

export interface AdvertismentProps {
  placementId: string;
  refreshLimit?: number;
  refreshTime?: number;
  position?: string;
  wording?: string;
  enabled?: boolean;
  media: keyof MediaTypes;
  size: keyof SizeTypes;
  format?: 'display' | 'sticky-stack' | 'rail' | 'anchor' | 'floating';
  stickyStackLimit?: number;
  stickyStackSpace?: number;
  stickyStackOffset?: number;
  rail?: string;
  railOffsetTop?: number;
  railOffsetBottom?: number;
  railCollisionWhitelist?: string[];
}

const mediaTypes: MediaTypes = {
  desktop: '(min-width: 1025px)',
  mobile: '(min-width: 320px) and (max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1024px)',
};

const sizeTypes: SizeTypes = {
  banner: [
    ['970', '250'],
    ['970', '90'],
    ['728', '90'],
  ],
  side: [['160', '600']],
  mobile: [['320', '50']],
  video: [['300', '250']],
};

const Advertisment: React.FC<AdvertismentProps> = ({
  placementId,
  refreshLimit = 10,
  refreshTime = 30,
  position = 'fixed-bottom-right',
  wording = 'Report Ad',
  enabled = true,
  media,
  size,
  format = 'display',
  stickyStackLimit = 1,
  stickyStackSpace = 2.5,
  stickyStackOffset = 25,
  rail = 'left',
  railOffsetTop = 200,
  railOffsetBottom = 0,
  railCollisionWhitelist = ['*'],
}) => {
  const adsEnabled = useContext(AdsContext);

  useMount(() => {
    if (window.nitroAds) {
      if (format === 'sticky-stack') {
        window.nitroAds.createAd(placementId, {
          format,
          demo: !adsEnabled,
          refreshLimit,
          refreshTime,
          mediaQuery: mediaTypes[media],
          sizes: sizeTypes[size],
          report: {
            enabled,
            wording,
            position,
          },
          stickyStackLimit,
          stickyStackSpace,
          stickyStackOffset,
        });
      } else if (format === 'rail') {
        window.nitroAds.createAd(placementId, {
          format,
          rail,
          railOffsetTop,
          railOffsetBottom,
          railCollisionWhitelist,
          demo: !adsEnabled,
          refreshLimit,
          refreshTime,
          mediaQuery: mediaTypes[media],
          sizes: sizeTypes[size],
          report: {
            enabled,
            wording,
            position,
          },
        });
      } else if (format === 'anchor') {
        window.nitroAds.createAd(placementId, {
          format,
          demo: !adsEnabled,
          refreshLimit,
          refreshTime,
          mediaQuery: mediaTypes[media],
          sizes: sizeTypes[size],
          report: {
            enabled,
            wording,
            position,
          },
        });
      } else if (format === 'floating') {
        window.nitroAds.createAd(placementId, {
          format,
          demo: !adsEnabled,
          refreshLimit,
          refreshTime,
          mediaQuery: mediaTypes[media],
          report: {
            enabled,
            wording,
            position,
          },
        });
      } else {
        // format === display
        window.nitroAds.createAd(placementId, {
          format: 'display',
          demo: !adsEnabled,
          refreshLimit,
          refreshTime,
          mediaQuery: mediaTypes[media],
          sizes: sizeTypes[size],
          report: {
            enabled,
            wording,
            position,
          },
        });
      }
    }
  });

  if (format === 'floating') {
    return '';
  }

  return <div className="advertisement-div mb-8" id={placementId} />;
};

export default Advertisment;
