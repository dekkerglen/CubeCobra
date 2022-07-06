import React, { useState, useCallback } from 'react';
import PodcastPropType from 'proptypes/PodcastPropType';

import { Card } from 'reactstrap';
import TimeAgo from 'react-timeago';
import AspectRatioBox from 'components/AspectRatioBox';
import htmlToText from 'html-to-text';
import Username from 'components/Username';

const PodcastEpisodePreview = ({ episode }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const short = htmlToText
    .fromString(episode.Body, {
      wordwrap: 130,
    })
    .substring(0, 200);

  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={2} className="text-ellipsis">
        <img className="content-preview-img" alt={episode.Title} src={episode.Image} />
        <h6 className="content-preview-banner podcast-preview-bg">
          <strong>Podcast</strong>
        </h6>
      </AspectRatioBox>
      <div className="w-100 pt-1 pb-1 px-2">
        <a href={`/content/episode/${episode.Id}`} className="stretched-link">
          <h6 className="text-muted text-ellipsis mt-0 mb-0 pb-1">{episode.Title}</h6>
        </a>
        <small>
          <p className="mb-0">{`${short}...`}</p>
        </small>
      </div>
      <div className={`w-100 pb-1 pt-0 px-2 m-0 ${hover ? 'preview-footer-bg-hover' : 'preview-footer-bg'}`}>
        <small className="float-start">
          By <Username userId={episode.Owner} defaultName={episode.Username} />
        </small>
        <small className="float-end">
          <TimeAgo date={episode.Date} />
        </small>
      </div>
    </Card>
  );
};

PodcastEpisodePreview.propTypes = {
  episode: PodcastPropType.isRequired,
};

export default PodcastEpisodePreview;
