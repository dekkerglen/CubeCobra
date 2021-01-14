import { useState, useCallback } from 'react';
import PodcastPropType from 'proptypes/PodcastPropType';

import { Card } from 'reactstrap';
import AspectRatioBox from 'components/AspectRatioBox';

const PodcastPreview = ({ podcast }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback(
    (event) => {
      if (!event.target.getAttribute('data-sublink')) {
        window.location.href = `/content/podcast/${podcast._id}`;
      }
    },
    [podcast],
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
        <img className="w-100" alt={podcast.title} src={podcast.image} />
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <h5 className="text-muted text-ellipsis my-0">{podcast.title}</h5>
        <small>
          <em className="text-muted text-ellipsis">
            By{' '}
            <a data-sublink href={`/user/view/${podcast.owner}`}>
              {podcast.username}
            </a>
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
