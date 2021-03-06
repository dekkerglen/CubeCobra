import React from 'react';
import PropTypes from 'prop-types';
import VideoPropType from 'proptypes/VideoPropType';

import { Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import VideoPreview from 'components/VideoPreview';
import Paginate from 'components/Paginate';
import Banner from 'components/Banner';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const PAGE_SIZE = 24;

const VideosPage = ({ loginCallback, videos, count, page }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <h4>Videos</h4>
    <Row>
      {videos.map((video) => (
        <Col className="mb-3" xs="12" sm="6" lg="4">
          <VideoPreview video={video} />
        </Col>
      ))}
    </Row>
    {count > PAGE_SIZE && (
      <Paginate count={Math.ceil(count / PAGE_SIZE)} active={parseInt(page, 10)} urlF={(i) => `/content/videos/${i}`} />
    )}
  </MainLayout>
);

VideosPage.propTypes = {
  loginCallback: PropTypes.string,
  videos: PropTypes.arrayOf(VideoPropType).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

VideosPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(VideosPage);
