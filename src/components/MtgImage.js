import React from 'react';

import PropTypes from 'prop-types';

const MtgImage = ({ image, showArtist }) => {
  if (showArtist) {
    return (
      <div className="position-relative">
        <img className="card-img-top w-100" alt={`Art by ${image.artist}`} src={image.uri} />
        <em className="cube-preview-artist">Art by {image.artist}</em>
      </div>
    );
  }

  return <img className="content-preview-img" alt={`Art by ${image.artist}`} src={image.uri} />;
};

MtgImage.propTypes = {
  image: PropTypes.shape({
    artist: PropTypes.string.isRequired,
    uri: PropTypes.string.isRequired,
  }).isRequired,
  showArtist: PropTypes.bool,
};

MtgImage.defaultProps = {
  showArtist: false,
};

export default MtgImage;
