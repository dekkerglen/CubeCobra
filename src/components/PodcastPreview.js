import React, { useState, useCallback } from 'react';
import PodcastPropType from 'proptypes/PodcastPropType';

import { Card } from 'reactstrap';
import AspectRatioBox from 'components/AspectRatioBox';
import Username from 'components/Username';

const PodcastPreview = ({ podcast }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={1} className="text-ellipsis">
        <img className="w-100" alt={podcast.Title} src={podcast.Image} />
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <a href={`/content/podcast/${podcast.Id}`} className="stretched-link">
          <h5 className="text-muted text-ellipsis my-0">{podcast.Title}</h5>
        </a>
        <small>
          <em className="text-muted text-ellipsis">
            By <Username userId={podcast.Owner} defaultName={podcast.Username} />
          </em>
        </small>
      </div>
    </Card>
  );
};

PodcastPreview.propTypes = {
  podcast: PodcastPropType.isRequired,
};

export default PodcastPreview;
