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

interface Podcast {
  id: string;
  title: string;
  description: string;
  date: string;
  user: User;
}

interface PodcastPageProps {
  loginCallback?: string;
  podcasts: Podcast[];
}

const PodcastPage: React.FC<PodcastPageProps> = ({ loginCallback = '/', podcasts }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Podcasts</h5>
      </CardHeader>
      {podcasts.map((podcast) => (
        <Card key={podcast.id}>
          <CardBody>
            <h5>{podcast.title}</h5>
            <p>{podcast.description}</p>
            <p>
              By{' '}
              <a href={`/user/view/${podcast.user.id}`} target="_blank" rel="noopener noreferrer">
                {podcast.user.username}
              </a>
              - <TimeAgo date={podcast.date} />
            </p>
            <Row>
              <Col xs={12} sm="6">
                <Button color="primary" block outline href={`/podcast/${podcast.id}`}>
                  Listen
                </Button>
              </Col>
              <Col xs={12} sm="6">
                <Button color="secondary" block outline href={`/podcast/${podcast.id}/details`}>
                  Details
                </Button>
              </Col>
            </Row>
          </CardBody>
        </Card>
      ))}
    </Card>
  </MainLayout>
);

export default RenderToRoot(PodcastPage);
