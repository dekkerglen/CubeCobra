import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';
import TimeAgo from 'react-timeago';

import Button from 'components/base/Button';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import User from 'datatypes/User';

interface Notice {
  id: string;
  type: string;
  body: string;
  date: string;
  user: User;
  subject?: string;
}

interface NoticePageProps {
  loginCallback?: string;
  notices: Notice[];
}

const NoticePage: React.FC<NoticePageProps> = ({ loginCallback = '/', notices }) => {
  const applications = notices.filter((notice) => notice.type === 'a');
  const reports = notices.filter((notice) => notice.type === 'cr');

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <h5>Content Creator Applications</h5>
        </CardHeader>
        {applications.map((application) => (
          <Card key={application.id}>
            <CardBody>
              <p>
                Details:
                <Card>
                  {application.body.split('\n').map((item, index) => (
                    <React.Fragment key={index}>
                      {item}
                      <br />
                    </React.Fragment>
                  ))}
                </Card>
              </p>
              <p>
                Submitted by:{' '}
                <a href={`/user/view/${application.user.id}`} target="_blank" rel="noopener noreferrer">
                  {application.user.username}
                </a>
                - <TimeAgo date={application.date} />
              </p>
              <Row>
                <Col xs={12} sm={6}>
                  <Button color="primary" block outline href={`/admin/application/approve/${application.id}`}>
                    Approve
                  </Button>
                </Col>
                <Col xs={12} sm={6}>
                  <Button color="danger" block outline href={`/admin/application/decline/${application.id}`}>
                    Decline
                  </Button>
                </Col>
              </Row>
            </CardBody>
          </Card>
        ))}
      </Card>
      <Card className="my-3">
        <CardHeader>
          <h5>Recent Comment Reports</h5>
        </CardHeader>
        {reports.map((report) => (
          <Card key={report.id}>
            <CardBody>
              <p>
                Comment:{' '}
                <a href={`/comment/${report.subject}`} target="_blank" rel="noopener noreferrer">
                  {report.subject}
                </a>
              </p>
              <p>Reason: {report.body}</p>
              <p>
                Reported by:{' '}
                <a href={`/user/view/${report.user.id}`} target="_blank" rel="noopener noreferrer">
                  {report.user.username}
                </a>
                - <TimeAgo date={report.date} />
              </p>
              <Row>
                <Col xs={12} sm={6}>
                  <Button color="primary" block outline href={`/admin/ignorereport/${report.id}`}>
                    Ignore
                  </Button>
                </Col>
                <Col xs={12} sm={6}>
                  <Button color="danger" block outline href={`/admin/removecomment/${report.id}`}>
                    Remove Comment
                  </Button>
                </Col>
              </Row>
            </CardBody>
          </Card>
        ))}
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(NoticePage);
