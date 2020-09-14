import React from 'react';
import PropTypes from 'prop-types';

import { CardHeader, Card, Row, Col, CardFooter } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import VideoPreview from 'components/VideoPreview';
import Paginate from 'components/Paginate';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const PAGE_SIZE = 24;

const VideosPage = ({ user, loginCallback, videos, count, page }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Card className="my-3">
      <CardHeader>
        <h5>Videos</h5>
      </CardHeader>
      <DynamicFlash />
      <Row>
        {videos.map((video) => (
          <Col className="mb-3" xs="12" sm="6" lg="4">
            <VideoPreview video={video} />
          </Col>
        ))}
      </Row>
      {count > PAGE_SIZE && (
        <CardFooter>
          <Paginate
            count={Math.ceil(count / PAGE_SIZE)}
            active={parseInt(page, 10)}
            urlF={(i) => `/content/videos/${i}`}
          />
        </CardFooter>
      )}
    </Card>
  </MainLayout>
);

VideosPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
  videos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

VideosPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(VideosPage);
