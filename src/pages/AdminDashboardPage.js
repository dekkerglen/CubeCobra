import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import ButtonLink from 'components/ButtonLink';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const AdminDashboardPage = ({
  loginCallback,
  commentReportCount,
  applicationCount,
  articlesInReview,
  videosInReview,
  podcastsInReview,
}) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h5>Admin Dashboard</h5>
      </CardHeader>
      <CardBody>
        <ButtonLink href="/admin/commentreports" block outline color="accent">
          {`Comment Reports (${commentReportCount})`}
        </ButtonLink>
        <ButtonLink href="/admin/applications" block outline color="accent">
          {`Content Creator Applications (${applicationCount})`}
        </ButtonLink>
        <ButtonLink href="/admin/comments" block outline color="accent">
          Recent Comments
        </ButtonLink>
        <ButtonLink href="/admin/reviewarticles" block outline color="accent">
          {`Review Articles (${articlesInReview})`}
        </ButtonLink>
        <ButtonLink href="/admin/reviewvideos" block outline color="accent">
          {`Review Videos (${videosInReview})`}
        </ButtonLink>
        <ButtonLink href="/admin/reviewpodcasts" block outline color="accent">
          {`Review Podcasts (${podcastsInReview})`}
        </ButtonLink>
        <ButtonLink href="/admin/featuredcubes" block outline color="accent">
          Featured Cubes Queue
        </ButtonLink>
      </CardBody>
    </Card>
  </MainLayout>
);

AdminDashboardPage.propTypes = {
  loginCallback: PropTypes.string,
  commentReportCount: PropTypes.number.isRequired,
  applicationCount: PropTypes.number.isRequired,
  articlesInReview: PropTypes.number.isRequired,
  videosInReview: PropTypes.number.isRequired,
  podcastsInReview: PropTypes.number.isRequired,
};

AdminDashboardPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(AdminDashboardPage);
