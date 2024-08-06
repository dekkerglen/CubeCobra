import React from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';

import PropTypes from 'prop-types';

import ButtonLink from 'components/ButtonLink';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const AdminDashboardPage = ({ loginCallback, noticeCount, contentInReview }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h5>Admin Dashboard</h5>
      </CardHeader>
      <CardBody>
        <ButtonLink href="/admin/notices" block outline color="accent">
          {`Notices (${noticeCount})`}
        </ButtonLink>
        <ButtonLink href="/admin/reviewcontent" block outline color="accent">
          {`Review Content (${contentInReview})`}
        </ButtonLink>
        <ButtonLink href="/admin/featuredcubes" block outline color="accent">
          featured cubes Queue
        </ButtonLink>
      </CardBody>
    </Card>
  </MainLayout>
);

AdminDashboardPage.propTypes = {
  loginCallback: PropTypes.string,
  noticeCount: PropTypes.number.isRequired,
  contentInReview: PropTypes.number.isRequired,
};

AdminDashboardPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(AdminDashboardPage);
