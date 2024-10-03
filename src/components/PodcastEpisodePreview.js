import React, { useCallback, useState } from 'react';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import Username from 'components/Username';
import Text from './base/Text';
import { Tile } from './base/Tile';
import { Flexbox } from './base/Layout';
import ContentPropType from 'proptypes/ContentPropType';

const PodcastEpisodePreview = ({ episode }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);

  return (
    <Tile
      href={`/content/episode/${episode.id}`}
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={2} className="text-ellipsis">
        <img className="content-preview-img" alt={episode.title} src={episode.image} />
        <Text bold className="absolute bottom-0 left-0 text-text bg-podcast bg-opacity-50 w-full mb-0 p-1">
          Podcast
        </Text>
      </AspectRatioBox>
      <Flexbox direction="col" className="p-1 flex-grow">
        <Text semibold md className="truncate">
          {episode.title}
        </Text>
        <Flexbox direction="row" justify="between">
          <Text xs className="text-text-secondary">
            By <Username user={episode.owner} />
          </Text>
          <Text xs className="text-text-secondary">
            <TimeAgo date={episode.date} />
          </Text>
        </Flexbox>
        <div className="flex-grow">
          <Text area xs>
            {episode.short}
          </Text>
        </div>
      </Flexbox>
    </Tile>
  );
};

PodcastEpisodePreview.propTypes = {
  episode: ContentPropType.isRequired,
};

export default PodcastEpisodePreview;
