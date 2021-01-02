import React, { useState, useCallback } from 'react';
import VideoPropType from 'proptypes/VideoPropType';

import { Card } from 'reactstrap';
import AspectRatioBox from 'components/AspectRatioBox';
import TimeAgo from 'react-timeago';

const VideoPreview = ({ video }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback(
    (event) => {
      if (!event.target.getAttribute('data-sublink')) {
        window.location.href = `/content/video/${video._id}`;
      }
    },
    [video],
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
      <AspectRatioBox ratio={2} className="text-ellipsis">
        <img className="content-preview-img" alt={video.title} src={video.image} />
        <h6 className="content-preview-banner video-preview-bg">
          <strong>Video</strong>
        </h6>
      </AspectRatioBox>
      <div className="w-100 pt-1 pb-1 px-2">
        <h6 className="text-muted text-ellipsis mt-0 mb-0 pb-1">{video.title}</h6>
        <small>
          <p className="mb-0">{video.short}</p>
        </small>
      </div>
      <div className={`w-100 pb-1 pt-0 px-2 m-0 ${hover ? 'preview-footer-bg-hover' : 'preview-footer-bg'}`}>
        <small className="float-left">
          By{' '}
          <a data-sublink href={`/user/view/${video.owner}`}>
            {video.username}
          </a>
        </small>
        <small className="float-right">
          <TimeAgo date={video.date} />
        </small>
      </div>
    </Card>
  );
};

VideoPreview.propTypes = {
  video: VideoPropType.isRequired,
};
export default VideoPreview;
