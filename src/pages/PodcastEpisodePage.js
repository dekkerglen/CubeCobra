import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import ContentPropType from 'proptypes/ContentPropType';
import ReactAudioPlayer from 'react-audio-player';
import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import CommentsSection from 'components/CommentsSection';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const PodcastEpisodePage = ({ loginCallback, episode }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="mb-3">
        <CardHeader>
          <h1>{episode.title}</h1>
          <h6>
            from <a href={`/content/podcast/${episode.podcast}`}>{episode.podcastName}</a>
            {' - '}
            <TimeAgo date={episode.date} />
          </h6>
        </CardHeader>
        <Row className="g-0">
          <Col xs="12" sm="4" className="pe-0">
            <AspectRatioBox ratio={1} className="text-ellipsis">
              <img className="w-100" alt={episode.title} src={episode.image} />
            </AspectRatioBox>
          </Col>
          <Col xs="12" sm="8" className="border-start ps-0">
            <CardBody>
              <ReactAudioPlayer src={episode.url} controls />
            </CardBody>
            <CardBody className="border-top" dangerouslySetInnerHTML={{ __html: episode.body }} />
          </Col>
        </Row>
        <div className="border-top">
          <CommentsSection parentType="episode" parent={episode.id} collapse={false} />
        </div>
      </Card>
    </MainLayout>
  );
};

PodcastEpisodePage.propTypes = {
  loginCallback: PropTypes.string,
  episode: ContentPropType.isRequired,
};

PodcastEpisodePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(PodcastEpisodePage);
