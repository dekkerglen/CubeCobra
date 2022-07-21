import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Spinner } from 'reactstrap';
import { csrfFetch } from 'utils/CSRF';

const MtgImage = ({ cardname, showArtist }) => {
  const [loaded, setLoaded] = useState(false);
  const [image, setImage] = useState(null);

  useEffect(() => {
    const getData = async () => {
      const response = await csrfFetch('/cube/api/imagedata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardname }),
      });
      const data = await response.json();
      setImage(data.data);
      setLoaded(true);
    };
    getData();
  }, [cardname]);

  if (!loaded) {
    return (
      <div className="centered">
        <Spinner size="lg" />
      </div>
    );
  }

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
  cardname: PropTypes.string.isRequired,
  showArtist: PropTypes.bool,
};

MtgImage.defaultProps = {
  showArtist: false,
};

export default MtgImage;
