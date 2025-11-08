import React from 'react';

import TimeAgo from 'react-timeago';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import User from '@utils/datatypes/User';
import MainLayout from 'layouts/MainLayout';

import { NoticeType } from '@utils/datatypes/Notice';

const ConfirmActionModalButton = withModal(Button, ConfirmActionModal);

interface Notice {
  id: string;
  type: string;
  body: string;
  date: string;
  user: User;
  subject?: string;
}

interface NoticePageProps {
  notices: Notice[];
}

const NoticePage: React.FC<NoticePageProps> = ({ notices }) => {
  const applications = notices.filter((notice) => notice.type === NoticeType.APPLICATION);
  const commentReports = notices.filter((notice) => notice.type === NoticeType.COMMENT_REPORT);
  const cubeReports = notices.filter((notice) => notice.type === NoticeType.CUBE_REPORT);

  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text md semibold>
            Content Creator Applications
          </Text>
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
                <Link href={`/user/view/${application.user.id}`} target="_blank" rel="noopener noreferrer">
                  {application.user.username}
                </Link>
                - <TimeAgo date={application.date} />
              </p>
              <Row>
                <Col xs={12} sm={6}>
                  <Button
                    type="link"
                    color="primary"
                    block
                    outline
                    href={`/admin/application/approve/${application.id}`}
                  >
                    Approve
                  </Button>
                </Col>
                <Col xs={12} sm={6}>
                  <Button
                    type="link"
                    color="danger"
                    block
                    outline
                    href={`/admin/application/decline/${application.id}`}
                  >
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
          <Text md semibold>
            Recent Comment Reports
          </Text>
        </CardHeader>
        {commentReports.map((report) => (
          <Card key={report.id}>
            <CardBody>
              <p>
                Comment:{' '}
                <Link href={`/comment/${report.subject}`} target="_blank" rel="noopener noreferrer">
                  {report.subject}
                </Link>
              </p>
              <p>Reason: {report.body}</p>
              <p>
                Reported by:{' '}
                <Link href={`/user/view/${report.user.id}`} target="_blank" rel="noopener noreferrer">
                  {report.user.username}
                </Link>
                - <TimeAgo date={report.date} />
              </p>
              <Row>
                <Col xs={12} sm={6}>
                  <Button type="link" color="primary" block outline href={`/admin/ignorereport/${report.id}`}>
                    Ignore
                  </Button>
                </Col>
                <Col xs={12} sm={6}>
                  <Button type="link" color="danger" block outline href={`/admin/removecomment/${report.id}`}>
                    Remove Comment
                  </Button>
                </Col>
              </Row>
            </CardBody>
          </Card>
        ))}
      </Card>
      <Card className="my-3">
        <CardHeader>
          <Text md semibold>
            Recent Cube Reports
          </Text>
        </CardHeader>
        {cubeReports.map((report) => (
          <Card key={report.id}>
            <CardBody>
              <p>
                User:{' '}
                <Link href={`/user/view/${report.subject}`} target="_blank" rel="noopener noreferrer">
                  {report.subject}
                </Link>
              </p>
              <p>{report.body}</p>
              <p>
                Reported by:{' '}
                <Link href={`/user/view/${report.user.id}`} target="_blank" rel="noopener noreferrer">
                  {report.user.username}
                </Link>
                - <TimeAgo date={report.date} />
              </p>
              <Row>
                <Col xs={12} sm={6}>
                  <Button type="link" color="primary" block outline href={`/admin/ignorereport/${report.id}`}>
                    Ignore
                  </Button>
                </Col>
                <Col xs={12} sm={6}>
                  <ConfirmActionModalButton
                    color="danger"
                    block
                    modalprops={{
                      target: `/admin/banuser/${report.id}`,
                      title: 'Ban User',
                      message: 'Are you sure you want to ban this user? ',
                      buttonText: 'Ban User',
                    }}
                  >
                    Ban User
                  </ConfirmActionModalButton>
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
