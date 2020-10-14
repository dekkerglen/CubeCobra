import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import { Card } from 'reactstrap';

import AspectRatioBox from 'components/AspectRatioBox';

import { getCubeDescription, getCubeId } from 'utils/Util';

const CubePreview = ({ cube }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback(
    (event) => {
      if (!event.target.getAttribute('data-sublink')) {
        window.location.href = `/cube/overview/${getCubeId(cube)}`;
      }
    },
    [cube],
  );

  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        <img className="w-100" alt={cube.image_name} src={cube.image_uri} />
        <em className="cube-preview-artist">Art by {cube.image_artist}</em>
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <h5 className="text-muted text-ellipsis my-0">{cube.name}</h5>
        <div className="text-muted text-ellipsis">{getCubeDescription(cube)}</div>
        <em className="text-muted text-ellipsis">
          Designed by{' '}
          <a data-sublink href={`/user/view/${cube.owner}`}>
            {cube.owner_name}
          </a>
        </em>
      </div>
    </Card>
  );
};

CubePreview.propTypes = {
  cube: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    shortId: PropTypes.string,
    urlAlias: PropTypes.string,
    name: PropTypes.string.isRequired,
    card_count: PropTypes.number.isRequired,
    type: PropTypes.string.isRequired,
    overrideCategory: PropTypes.bool,
    categoryOverride: PropTypes.string,
    categoryPrefixes: PropTypes.arrayOf(PropTypes.string),
    image_name: PropTypes.string.isRequired,
    image_artist: PropTypes.string.isRequired,
    image_uri: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    owner_name: PropTypes.string.isRequired,
  }).isRequired,
};

export default CubePreview;
