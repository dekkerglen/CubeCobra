import React from 'react';

import ReactAudioPlayer from 'react-audio-player';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/base/AspectRatioBox';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CommentsSection from 'components/comments/CommentsSection';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import Episode from 'datatypes/Episode';
import MainLayout from 'layouts/MainLayout';

interface PodcastEpisodePageProps {
  loginCallback?: string;
  episode: Episode;
}

const PodcastEpisodePage: React.FC<PodcastEpisodePageProps> = ({ loginCallback = '/', episode }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="col" gap="2" alignItems="start">
            <Text semibold lg>
              {episode.title}
            </Text>
            <Text semibold sm>
              from <Link href={`/content/podcast/${episode.podcast}`}>{episode.podcastName}</Link>
              {' - '}
              <TimeAgo date={episode.date} />
            </Text>
          </Flexbox>
        </CardHeader>
        <Row className="g-0">
          <Col xs={12} sm={4} className="pe-0">
            <AspectRatioBox ratio={1} className="text-ellipsis">
              <img className="w-full" alt={episode.title} src={episode.image} />
            </AspectRatioBox>
          </Col>
          <Col xs={12} sm={8} className="border-start ps-0">
            <CardBody>
              <ReactAudioPlayer src={episode.url} controls className="w-full" />
            </CardBody>
            <CardBody className="border-top">
              <div dangerouslySetInnerHTML={{ __html: episode.body || '' }} />
            </CardBody>
          </Col>
        </Row>
        <div className="border-top">
          <CommentsSection parentType="episode" parent={episode.id} collapse={false} />
        </div>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(PodcastEpisodePage);
