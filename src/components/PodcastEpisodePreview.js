import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { Card } from 'reactstrap';
import TimeAgo from 'react-timeago';
import AspectRatioBox from 'components/AspectRatioBox';

const PodcastEpisodePreview = ({ episode }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback(
    (event) => {
      if (!event.target.getAttribute('data-sublink')) {
        window.location.href = `/content/episode/${episode._id}`;
      }
    },
    [episode],
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
      <AspectRatioBox ratio={1} className="text-ellipsis">
        <img className="w-100" alt={episode.title} src={episode.image} />
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <h5 className="text-muted text-ellipsis my-0">{episode.podcastname}</h5>
        <small>
          {`${episode.title} - `}
          <TimeAgo date={episode.date} />
        </small>
      </div>
    </Card>
  );
};

PodcastEpisodePreview.propTypes = {
  episode: PropTypes.shape({
    title: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    podcastname: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }).isRequired,
};

export default PodcastEpisodePreview;
