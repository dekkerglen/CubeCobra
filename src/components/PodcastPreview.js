import React, { useCallback, useState } from 'react';
import { Card } from 'reactstrap';

import ContentPropType from 'proptypes/ContentPropType';

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
        <img className="w-100" alt={podcast.title} src={podcast.image} />
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <a href={`/content/podcast/${podcast.id}`} className="stretched-link">
          <h5 className="text-muted text-ellipsis my-0">{podcast.title}</h5>
        </a>
        <small>
          <em className="text-muted text-ellipsis">
            By <Username user={podcast.owner} />
          </em>
        </small>
      </div>
    </Card>
  );
};

PodcastPreview.propTypes = {
  podcast: ContentPropType.isRequired,
};

export default PodcastPreview;
