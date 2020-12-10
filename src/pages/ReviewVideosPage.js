import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';
import VideoPropType from 'proptypes/VideoPropType';

import { Card, CardHeader, CardBody, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import ButtonLink from 'components/ButtonLink';
import VideoPreview from 'components/VideoPreview';

const PAGE_SIZE = 24;

const ReviewVideosPage = ({ user, loginCallback, videos, count, page }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Videos in Review</h5>
        {count > PAGE_SIZE ? (
          <>
            <h6>
              {`Displaying ${PAGE_SIZE * page + 1}-${Math.min(count, PAGE_SIZE * (page + 1))} of ${count} Videos`}
            </h6>
            <Paginate
              count={Math.ceil(count / PAGE_SIZE)}
              active={parseInt(page, 10)}
              urlF={(i) => `/admin/reviewvideos/${i}`}
            />
          </>
        ) : (
          <h6>{`Displaying all ${count} Videos`}</h6>
        )}
      </CardHeader>
      {videos.map((video) => (
        <CardBody className="border-top">
          <Row>
            <Col xs="12" sm="4">
              <VideoPreview video={video} />
            </Col>
            <Col xs="12" sm="4">
              <ButtonLink color="success" outline block href={`/admin/publishvideo/${video._id}`}>
                Publish
              </ButtonLink>
            </Col>
            <Col xs="12" sm="4">
              <ButtonLink color="danger" outline block href={`/admin/removevideoreview/${video._id}`}>
                Remove from Reviews
              </ButtonLink>
            </Col>
          </Row>
        </CardBody>
      ))}
    </Card>
  </MainLayout>
);

ReviewVideosPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  videos: PropTypes.arrayOf(VideoPropType).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

ReviewVideosPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ReviewVideosPage);
