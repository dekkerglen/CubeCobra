import React from 'react';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import Text from '../base/Text';
import { Tile } from '../base/Tile';
import { Flexbox } from '../base/Layout';
import Podcast from 'datatypes/Podcast';

interface PodcastPreviewProps {
  podcast: Podcast;
}

const PodcastPreview: React.FC<PodcastPreviewProps> = ({ podcast }) => {
  return (
    <Tile href={`/content/podcast/${podcast.id}`}>
      <AspectRatioBox ratio={1.9} className="text-ellipsis">
        {podcast.image && <img className="w-100" alt={podcast.title} src={podcast.image} />}
        <Text bold className="absolute bottom-0 left-0 text-white text-shadow bg-podcast bg-opacity-50 w-full mb-0 p-1">
          Podcast Episode
        </Text>
      </AspectRatioBox>
      <Flexbox direction="col" className="p-1 flex-grow">
        <Text semibold md className="truncate">
          {podcast.title}
        </Text>
        <Flexbox direction="row" justify="between">
          <Text sm className="text-text-secondary">
            By {podcast.owner.username}
          </Text>
          <Text sm className="text-text-secondary">
            <TimeAgo date={podcast.date} />
          </Text>
        </Flexbox>
        <div className="flex-grow">
          <Text area sm>
            {podcast.body}...
          </Text>
        </div>
      </Flexbox>
    </Tile>
  );
};

export default PodcastPreview;
