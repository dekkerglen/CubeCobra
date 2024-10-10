import React from 'react';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';
import Video from 'datatypes/Video';
import Text from './base/Text';
import { Tile } from './base/Tile';
import { Flexbox } from './base/Layout';

export interface VideoPreviewProps {
  video: Video;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ video }) => {
  return (
    <Tile href={`/content/video/${video.id}`}>
      <AspectRatioBox ratio={1.9}>
        {video.image && <MtgImage image={video.image} />}
        <Text bold className="absolute bottom-0 left-0 text-white text-shadow bg-video bg-opacity-50 w-full mb-0 p-1">
          Video
        </Text>
      </AspectRatioBox>
      <Flexbox direction="col" className="p-1 flex-grow">
        <Text semibold md className="truncate">
          {video.title}
        </Text>
        <Flexbox direction="row" justify="between">
          <Text sm className="text-text-secondary">
            By <Username user={video.owner} />
          </Text>
          <Text sm className="text-text-secondary">
            <TimeAgo date={video.date} />
          </Text>
        </Flexbox>
        <div className="flex-grow">
          <Text area sm>
            {video.short}
          </Text>
        </div>
      </Flexbox>
    </Tile>
  );
};

export default VideoPreview;
