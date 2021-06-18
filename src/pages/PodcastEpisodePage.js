import React from 'react';
import PropTypes from 'prop-types';
import PodcastPropType from 'proptypes/PodcastPropType';
import UserPropType from 'proptypes/UserPropType';

import { CardHeader, Card, Row, Col, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import AspectRatioBox from 'components/AspectRatioBox';
import CommentsSection from 'components/CommentsSection';
import ReactAudioPlayer from 'react-audio-player';
import TimeAgo from 'react-timeago';

const PodcastEpisodePage = ({ user, loginCallback, episode }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <DynamicFlash />
      <Card className="mb-3">
        <CardHeader>
          <h1>{episode.title}</h1>
          <h6>
            From <a href={`/content/podcast/${episode.podcast}`}>{episode.podcastname}</a>
            {' - '}
            <TimeAgo date={episode.date} />
          </h6>
        </CardHeader>
        <Row noGutters>
          <Col xs="12" sm="4" className="pr-0">
            <AspectRatioBox ratio={1} className="text-ellipsis">
              <img className="w-100" alt={episode.title} src={episode.image} />
            </AspectRatioBox>
          </Col>
          <Col xs="12" sm="8" className="border-left pl-0">
            <CardBody>
              <ReactAudioPlayer src={episode.source} controls />
            </CardBody>
            <CardBody className="border-top" dangerouslySetInnerHTML={{ __html: episode.description }} />
          </Col>
        </Row>
        <div className="border-top">
          <CommentsSection parentType="episode" parent={episode._id} collapse={false} />
        </div>
      </Card>
    </MainLayout>
  );
};

PodcastEpisodePage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  episode: PodcastPropType.isRequired,
};

PodcastEpisodePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(PodcastEpisodePage);
