import React from 'react';
import PropTypes from 'prop-types';
import PodcastPropType from 'proptypes/PodcastPropType';

import { Card, CardHeader, CardBody, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import ButtonLink from 'components/ButtonLink';
import PodcastPreview from 'components/PodcastPreview';

const PAGE_SIZE = 24;

const ReviewPodcastsPage = ({ loginCallback, podcasts, count, page }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Podcasts in Review</h5>
        {count > PAGE_SIZE ? (
          <>
            <h6>
              {`Displaying ${PAGE_SIZE * page + 1}-${Math.min(count, PAGE_SIZE * (page + 1))} of ${count} Podcasts`}
            </h6>
            <Paginate
              count={Math.ceil(count / PAGE_SIZE)}
              active={parseInt(page, 10)}
              urlF={(i) => `/admin/reviewpodcasts/${i}`}
            />
          </>
        ) : (
          <h6>{`Displaying all ${count} Podcasts`}</h6>
        )}
      </CardHeader>
      {podcasts.map((podcast) => (
        <CardBody className="border-top">
          <Row>
            <Col xs="12" sm="4">
              <PodcastPreview podcast={podcast} />
            </Col>
            <Col xs="12" sm="4">
              <ButtonLink color="success" outline block href={`/admin/publishpodcast/${podcast._id}`}>
                Publish
              </ButtonLink>
            </Col>
            <Col xs="12" sm="4">
              <ButtonLink color="danger" outline block href={`/admin/removepodcastreview/${podcast._id}`}>
                Remove from Reviews
              </ButtonLink>
            </Col>
          </Row>
        </CardBody>
      ))}
    </Card>
  </MainLayout>
);

ReviewPodcastsPage.propTypes = {
  loginCallback: PropTypes.string,
  podcasts: PropTypes.arrayOf(PodcastPropType).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

ReviewPodcastsPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ReviewPodcastsPage);
