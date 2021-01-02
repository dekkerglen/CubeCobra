import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardHeader, CardBody, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import ButtonLink from 'components/ButtonLink';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import TimeAgo from 'react-timeago';

const PAGE_SIZE = 24;

const CommentReportsPage = ({ user, loginCallback, reports, count, page }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Recent Comments</h5>
        {count > PAGE_SIZE ? (
          <>
            <h6>
              {`Displaying ${PAGE_SIZE * page + 1}-${Math.min(count, PAGE_SIZE * (page + 1))} of ${count} Reports`}
            </h6>
            <Paginate
              count={Math.ceil(count / PAGE_SIZE)}
              active={parseInt(page, 10)}
              urlF={(i) => `/admin/commentreports/${i}`}
            />
          </>
        ) : (
          <h6>{`Displaying all ${count} Reports`}</h6>
        )}
      </CardHeader>
      {reports.map((report) => (
        <Card>
          <CardBody>
            <p>
              Comment:{' '}
              <a href={`/comment/${report.commentid}`} target="_blank" rel="noopener noreferrer">
                {report.commentid}
              </a>
            </p>
            <p>Reason: {report.reason}</p>
            <p>Details: {report.info}</p>
            <p>
              Reported by:{' '}
              <a href={`/user/view/${report.reportee}`} target="_blank" rel="noopener noreferrer">
                {report.reportee}
              </a>
              - <TimeAgo date={report.timePosted} />
            </p>
            <Row>
              <Col xs="12" sm="6">
                <ButtonLink color="success" block outline href={`/admin/ignorereport/${report._id}`}>
                  Ignore
                </ButtonLink>
              </Col>
              <Col xs="12" sm="6">
                <ButtonLink color="danger" block outline href={`/admin/removecomment/${report._id}`}>
                  Remove Comment
                </ButtonLink>
              </Col>
            </Row>
          </CardBody>
        </Card>
      ))}
    </Card>
  </MainLayout>
);

CommentReportsPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  reports: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

CommentReportsPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CommentReportsPage);
