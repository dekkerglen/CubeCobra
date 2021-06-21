import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

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

// const formats = ['display', 'sticky-stack', 'rail'];

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
  useEffect(() => {
    if (format === 'sticky-stack') {
      window.nitroAds.createAd(placementId, {
        format,
        demo: true,
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
        demo: true,
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
        demo: true,
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
  position: PropTypes.number,
  wording: PropTypes.string,
  enabled: PropTypes.bool,
  stickyStackLimit: PropTypes.number,
  stickyStackSpace: PropTypes.number,
  stickyStackOffset: PropTypes.number,
  rail: PropTypes.string,
  railOffsetTop: PropTypes.number,
  railOffsetBottom: PropTypes.number,
  railCollisionWhitelist: PropTypes.arrayOf(),
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
  railCollisionWhitelist: ['navbar', 'react-root', '.rail-left', '.rail-right'],
};

export default Advertisment;
