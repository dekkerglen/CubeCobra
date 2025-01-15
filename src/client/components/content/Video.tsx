import React from 'react';

import ReactPlayer from 'react-player';
import TimeAgo from 'react-timeago';

import { CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import CommentsSection from 'components/comments/CommentsSection';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import VideoType from 'datatypes/Video';

interface VideoProps {
  video: VideoType;
}

const Video: React.FC<VideoProps> = ({ video }) => {
  return (
    <>
      <CardHeader>
        <Text semibold lg>
          {video.title}
        </Text>
        <Text semibold sm>
          By <Username user={video.owner} />
          {' | '}
          <TimeAgo date={video.date} />
        </Text>
      </CardHeader>
      <CardBody>
        <div className="player-wrapper">
          <ReactPlayer className="react-player" url={video.url} width="100%" height="100%" />
        </div>
      </CardBody>
      <CardBody>
        <Markdown markdown={video.body} />
      </CardBody>
      <div className="border-t">
        <CommentsSection parentType="video" parent={video.id} collapse={false} />
      </div>
    </>
  );
};

export default Video;
