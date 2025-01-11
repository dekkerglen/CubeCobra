import React from 'react';

import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserPreview from 'components/UserPreview';
import Cube from 'datatypes/Cube';
import User from 'datatypes/User';
import MainLayout from 'layouts/MainLayout';

interface UserSocialPageProps {
  followedCubes: Cube[];
  followedUsers: User[];
  followers: User[];
  loginCallback?: string;
}

const UserSocialPage: React.FC<UserSocialPageProps> = ({
  followedCubes,
  followedUsers,
  followers,
  loginCallback = '/',
}) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Row className="my-3">
      <Col xs={6}>
        <Card>
          <CardHeader>
            <Text semibold lg>
              Followed cubes
            </Text>
          </CardHeader>
          {followedCubes.length > 0 ? (
            <CardBody className="p-0">
              <Row className="g-0">
                {followedCubes.map((cube) => (
                  <Col key={cube.id} xs={6} md={4}>
                    <CubePreview cube={cube} />
                  </Col>
                ))}
              </Row>
            </CardBody>
          ) : (
            <CardBody>You aren't following any cubes.</CardBody>
          )}
        </Card>
      </Col>
      <Col xs={6}>
        <Card>
          <CardHeader>
            <Text semibold lg>
              Followed Users
            </Text>
          </CardHeader>
          {followedUsers.length > 0 ? (
            <CardBody className="p-0">
              <Row className="g-0">
                {followedUsers.map((item) => (
                  <Col key={item.id} xs={6} md={4}>
                    <UserPreview user={item} />
                  </Col>
                ))}
              </Row>
            </CardBody>
          ) : (
            <CardBody>You aren't following any users.</CardBody>
          )}
        </Card>
      </Col>
      {followers.length > 0 && (
        <Col xs={12}>
          <Card className="mt-3">
            <CardHeader>
              <Text semibold lg>
                Followers
              </Text>
            </CardHeader>
            <CardBody className="p-0">
              <Row className="g-0">
                {followers.map((item) => (
                  <Col key={item.id} xs={6} sm={3} lg={2}>
                    <UserPreview user={item} />
                  </Col>
                ))}
              </Row>
            </CardBody>
          </Card>
        </Col>
      )}
    </Row>
  </MainLayout>
);

export default RenderToRoot(UserSocialPage);
