import React, { useCallback, useState } from 'react';
import { Card } from 'reactstrap';

import ContentPropType from 'proptypes/ContentPropType';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';

const VideoPreview = ({ video }) => {
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
      <AspectRatioBox ratio={2} className="text-ellipsis">
        <MtgImage image={video.image} />
        <h6 className="content-preview-banner video-preview-bg">
          <strong>Video</strong>
        </h6>
      </AspectRatioBox>
      <div className="w-100 pt-1 pb-1 px-2">
        <a href={`/content/video/${video.id}`} className="stretched-link">
          <h6 className="text-muted text-ellipsis mt-0 mb-0 pb-1">{video.title}</h6>
        </a>
        <small>
          <p className="mb-0">{video.short}</p>
        </small>
      </div>
      <div className={`w-100 pb-1 pt-0 px-2 m-0 ${hover ? 'preview-footer-bg-hover' : 'preview-footer-bg'}`}>
        <small className="float-start">
          By <Username user={video.owner} />
        </small>
        <small className="float-end">
          <TimeAgo date={video.date} />
        </small>
      </div>
    </Card>
  );
};

VideoPreview.propTypes = {
  video: ContentPropType.isRequired,
};
export default VideoPreview;
