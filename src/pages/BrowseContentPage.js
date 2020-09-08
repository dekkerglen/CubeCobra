import React from 'react';
import PropTypes from 'prop-types';

import { CardHeader, Card, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import PodcastPreview from 'components/PodcastPreview';
import ArticlePreview from 'components/ArticlePreview';
import VideoPreview from 'components/VideoPreview';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const BrowseContentPage = ({ user, loginCallback, podcasts, episodes, articles, videos }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Row>
            <Col xs="12" sm="6">
              <h5>Articles</h5>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/articles" className="float-right">
                View more articles
              </a>
            </Col>
          </Row>
        </CardHeader>
        <DynamicFlash />
        <Row>
          {articles.map((article) => (
            <Col className="mb-3" xs="12" sm="6" lg="4">
              <ArticlePreview article={article} />
            </Col>
          ))}
        </Row>
      </Card>
      <Card className="my-3">
        <CardHeader>
          <Row>
            <Col xs="12" sm="6">
              <h5>Videos</h5>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/videos" className="float-right">
                View more videos
              </a>
            </Col>
          </Row>
        </CardHeader>
        <DynamicFlash />
        <Row>
          {videos.map((video) => (
            <Col className="mb-3" xs="12" sm="6" lg="4">
              <VideoPreview video={video} />
            </Col>
          ))}
        </Row>
      </Card>
      <Card className="my-3">
        <CardHeader>
          <Row>
            <Col xs="12" sm="6">
              <h5>Podcast Episodes</h5>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/podcasts" className="float-right">
                View more podcasts
              </a>
            </Col>
          </Row>
        </CardHeader>
        <DynamicFlash />
        <Row>
          {episodes.map((episode) => (
            <Col className="mb-3" xs="12" sm="6" lg="4">
              <PodcastEpisodePreview episode={episode} />
            </Col>
          ))}
        </Row>
      </Card>
      <Card className="my-3">
        <CardHeader>
          <Row>
            <Col xs="12" sm="6">
              <h5>Podcasts</h5>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/podcasts" className="float-right">
                View more podcasts
              </a>
            </Col>
          </Row>
        </CardHeader>
        <DynamicFlash />
        <Row>
          {podcasts.map((podcast) => (
            <Col className="mb-3" xs="12" sm="6" lg="4">
              <PodcastPreview podcast={podcast} />
            </Col>
          ))}
        </Row>
      </Card>
    </MainLayout>
  );
};

BrowseContentPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
  podcasts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  videos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  articles: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

BrowseContentPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(BrowseContentPage);
