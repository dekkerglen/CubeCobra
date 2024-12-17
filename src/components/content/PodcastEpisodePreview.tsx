import React from 'react';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/base/AspectRatioBox';
import Text from '../base/Text';
import { Tile } from '../base/Tile';
import { Flexbox } from '../base/Layout';
import Episode from 'datatypes/Episode';

interface PodcastEpisodePreviewProps {
  episode: Episode;
}

const PodcastEpisodePreview: React.FC<PodcastEpisodePreviewProps> = ({ episode }) => {
  return (
    <Tile href={`/content/episode/${episode.id}`}>
      <AspectRatioBox ratio={1.9} className="text-ellipsis">
        {episode.image && <img className="w-full" alt={episode.podcastName} src={episode.image} />}
        <Text bold className="absolute bottom-0 left-0 text-white text-shadow bg-podcast bg-opacity-50 w-full mb-0 p-1">
          Podcast Episode
        </Text>
      </AspectRatioBox>
      <Flexbox direction="col" className="p-1 flex-grow">
        <Text semibold md className="truncate">
          {episode.title}
        </Text>
        <Flexbox direction="row" justify="between">
          <Text sm className="text-text-secondary">
            By {episode.owner.username}
          </Text>
          <Text sm className="text-text-secondary">
            <TimeAgo date={episode.date} />
          </Text>
        </Flexbox>
        <div className="flex-grow">
          <Text area sm>
            {episode.short}...
          </Text>
        </div>
      </Flexbox>
    </Tile>
  );
};

export default PodcastEpisodePreview;
