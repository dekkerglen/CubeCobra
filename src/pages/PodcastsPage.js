import React from 'react';
import PropTypes from 'prop-types';

import { CardHeader, Card, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import PodcastPreview from 'components/PodcastPreview';
import Paginate from 'components/Paginate';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Advertisement from 'components/Advertisement';

const PAGE_SIZE = 24;

const PodcastsPage = ({ user, loginCallback, podcasts, episodes, count, page }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Podcasts</h5>
      </CardHeader>
      <Row>
        {podcasts.map((podcast) => (
          <Col xs="12" sm="6" lg="3">
            <PodcastPreview podcast={podcast} />
          </Col>
        ))}
      </Row>
    </Card>
    <h4>Podcast Episodes</h4>
    <DynamicFlash />
    <Row>
      {episodes.map((episode) => (
        <Col className="mb-3" xs="12" sm="6" lg="4">
          <PodcastEpisodePreview episode={episode} />
        </Col>
      ))}
    </Row>
    {count > PAGE_SIZE && (
      <Paginate
        count={Math.ceil(count / PAGE_SIZE)}
        active={parseInt(page, 10)}
        urlF={(i) => `/content/podcasts/${i}`}
      />
    )}
  </MainLayout>
);

PodcastsPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
  podcasts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

PodcastsPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(PodcastsPage);
