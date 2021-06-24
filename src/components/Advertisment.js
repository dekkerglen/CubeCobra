import React, { useEffect, useContext } from 'react';
import PropTypes from 'prop-types';

import AdsContext from 'contexts/AdsContext';

const mediaTypes = {
  desktop: '(min-width: 1025px)',
  mobile: '(min-width: 320px) and (max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1024px)',
};

const sizeTypes = {
  banner: [
    ['970', '250'],
    ['970', '90'],
    ['728', '90'],
  ],
  side: [['160', '600']],
  mobile: [['320', '50']],
};

// const formats = ['display', 'sticky-stack', 'rail', 'anchor'];

const Advertisment = ({
  placementId,
  refreshLimit,
  refreshTime,
  position,
  wording,
  enabled,
  media,
  size,
  format,
  stickyStackLimit,
  stickyStackSpace,
  stickyStackOffset,
  rail,
  railOffsetTop,
  railOffsetBottom,
  railCollisionWhitelist,
}) => {
  const adsEnabled = useContext(AdsContext);

  useEffect(() => {
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

  return <div className="advertisement-div" id={placementId} />;
};

Advertisment.propTypes = {
  placementId: PropTypes.string.isRequired,
  media: PropTypes.string.isRequired,
  size: PropTypes.string.isRequired,
  format: PropTypes.string,
  refreshLimit: PropTypes.number,
  refreshTime: PropTypes.number,
  position: PropTypes.string,
  wording: PropTypes.string,
  enabled: PropTypes.bool,
  stickyStackLimit: PropTypes.number,
  stickyStackSpace: PropTypes.number,
  stickyStackOffset: PropTypes.number,
  rail: PropTypes.string,
  railOffsetTop: PropTypes.number,
  railOffsetBottom: PropTypes.number,
  railCollisionWhitelist: PropTypes.arrayOf(PropTypes.string),
};

Advertisment.defaultProps = {
  refreshLimit: 10,
  refreshTime: 90,
  position: 'fixed-bottom-right',
  wording: 'Report Ad',
  enabled: true,
  format: 'display',
  stickyStackLimit: 1,
  stickyStackSpace: 2.5,
  stickyStackOffset: 25,
  rail: 'left',
  railOffsetTop: 200,
  railOffsetBottom: 0,
  railCollisionWhitelist: ['*'],
};

export default Advertisment;
