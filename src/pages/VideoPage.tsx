import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';
import TimeAgo from 'react-timeago';

import Button from 'components/base/Button';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface User {
  id: string;
  username: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  date: string;
  user: User;
}

interface VideoPageProps {
  loginCallback?: string;
  videos: Video[];
}

const VideoPage: React.FC<VideoPageProps> = ({ loginCallback = '/', videos }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Videos</h5>
      </CardHeader>
      {videos.map((video) => (
        <CardBody key={video.id} className="border-top">
          <Row>
            <Col xs="12" sm="8">
              <h5>{video.title}</h5>
              <p>{video.description}</p>
              <p>
                By{' '}
                <a href={`/user/view/${video.user.id}`} target="_blank" rel="noopener noreferrer">
                  {video.user.username}
                </a>
                - <TimeAgo date={video.date} />
              </p>
            </Col>
            <Col xs="12" sm="4">
              <Button color="primary" outline block href={`/video/${video.id}`}>
                Watch Video
              </Button>
            </Col>
          </Row>
        </CardBody>
      ))}
    </Card>
  </MainLayout>
);

export default RenderToRoot(VideoPage);
