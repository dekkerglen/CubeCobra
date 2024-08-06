import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

import ButtonLink from 'components/ButtonLink';
import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const PAGE_SIZE = 24;

const AdminDashboardPage = ({ loginCallback, applications, count, page }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Content Creator Applications</h5>
        {count > PAGE_SIZE ? (
          <>
            <h6>
              {`Displaying ${PAGE_SIZE * page + 1}-${Math.min(count, PAGE_SIZE * (page + 1))} of ${count} Applications`}
            </h6>
            <Paginate
              count={Math.ceil(count / PAGE_SIZE)}
              active={parseInt(page, 10)}
              urlF={(i) => `/admin/commentreports/${i}`}
            />
          </>
        ) : (
          <h6>{`Displaying all ${count} Applications`}</h6>
        )}
      </CardHeader>
      {applications.map((application) => (
        <Card>
          <CardBody>
            <p>
              Details:
              <Card>
                {application.info.split('\n').map((item) => (
                  <>
                    {item}
                    <br />
                  </>
                ))}
              </Card>
            </p>
            <p>
              Submitted by by:{' '}
              <a href={`/user/view/${application.user.id}`} target="_blank" rel="noopener noreferrer">
                {application.user.username}
              </a>
              - <TimeAgo date={application.timePosted} />
            </p>
            <Row>
              <Col xs="12" sm="6">
                <ButtonLink color="accent" block outline href={`/admin/application/approve/${application.id}`}>
                  Approve
                </ButtonLink>
              </Col>
              <Col xs="12" sm="6">
                <ButtonLink color="unsafe" block outline href={`/admin/application/decline/${application.id}`}>
                  Decline
                </ButtonLink>
              </Col>
            </Row>
          </CardBody>
        </Card>
      ))}
    </Card>
  </MainLayout>
);

AdminDashboardPage.propTypes = {
  loginCallback: PropTypes.string,
  applications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

AdminDashboardPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(AdminDashboardPage);
