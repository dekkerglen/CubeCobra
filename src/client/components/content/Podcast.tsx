import React from 'react';

import AspectRatioBox from 'components/base/AspectRatioBox';
import { CardBody,CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CommentsSection from 'components/comments/CommentsSection';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import Username from 'components/Username';
import Episode from 'datatypes/Episode';
import PodcastType from 'datatypes/Podcast';

interface PodcastProps {
  podcast: PodcastType;
  episodes: Episode[];
}

const Podcast: React.FC<PodcastProps> = ({ podcast, episodes }) => {
  return (
    <>
      <CardHeader>
        <Flexbox direction="col" gap="2" alignItems="start">
          <Text semibold xl>
            {podcast.title}
          </Text>
          <Text semibold sm>
            By <Username user={podcast.owner} />
          </Text>
        </Flexbox>
      </CardHeader>
      <Row>
        <Col xs={12} sm={4}>
          <AspectRatioBox ratio={1} className="text-ellipsis">
            <img className="w-full" alt={podcast.title} src={podcast.image} />
          </AspectRatioBox>
        </Col>
        <Col xs={12} sm={8}>
          <CardBody>
            <div dangerouslySetInnerHTML={{ __html: podcast.description || '' }} />
          </CardBody>
        </Col>
      </Row>
      <CardBody className="border-top">
        {episodes.length <= 0 ? (
          <p>No episodes available. Check back later for new episodes!</p>
        ) : (
          <Row>
            {episodes.map((episode) => (
              <Col key={episode.id} xs={12} sm={6} md={3} className="pb-3">
                <PodcastEpisodePreview episode={episode} />
              </Col>
            ))}
          </Row>
        )}
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="podcast" parent={podcast.id} collapse={false} />
      </div>
    </>
  );
};

export default Podcast;
