import React from 'react';
import VideoPropType from 'proptypes/VideoPropType';

import Markdown from 'components/Markdown';
import CommentsSection from 'components/CommentsSection';
import Username from 'components/Username';
import TimeAgo from 'react-timeago';
import ReactPlayer from 'react-player';

import { CardBody, CardHeader } from 'reactstrap';

const Video = ({ video }) => {
  return (
    <>
      <CardHeader>
        <h1>{video.Title}</h1>
        <h6>
          By <Username userId={video.Owner} defaultName={video.Username} />
          {' | '}
          <TimeAgo date={video.Date} />
        </h6>
      </CardHeader>
      <CardBody>
        <div className="player-wrapper">
          <ReactPlayer className="react-player" url={video.Url} width="100%" height="100%" />
        </div>
      </CardBody>
      <CardBody>
        <Markdown markdown={video.Body} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="video" parent={video.Id} collapse={false} />
      </div>
    </>
  );
};
Video.propTypes = {
  video: VideoPropType.isRequired,
};

export default Video;
