import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import Banner from 'components/Banner';
import CubePreview from 'components/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserPreview from 'components/UserPreview';
import MainLayout from 'layouts/MainLayout';

const UserSocialPage = ({ followedCubes, followedUsers, followers, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Row className="my-3">
      <Col xs={6}>
        <Card>
          <CardHeader>
            <h5 className="mb-0">Followed cubes</h5>
          </CardHeader>
          {followedCubes.length > 0 ? (
            <CardBody className="p-0">
              <Row className="g-0">
                {followedCubes.map((cube) => (
                  <Col key={cube.id} xs={12} sm={6}>
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
            <h5 className="mb-0">Followed Users</h5>
          </CardHeader>
          {followedUsers.length > 0 ? (
            <CardBody className="p-0">
              <Row className="g-0">
                {followedUsers.map((item) => (
                  <Col key={item.id} xs={12} sm={6}>
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
              <h5 className="mb-0">Followers</h5>
            </CardHeader>
            <CardBody className="p-0">
              <Row className="g-0">
                {followers.map((item) => (
                  <Col key={item.id} xs={6} sm={3}>
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

UserSocialPage.propTypes = {
  followedCubes: PropTypes.arrayOf(CubePropType).isRequired,
  followedUsers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  loginCallback: PropTypes.string,
};

UserSocialPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(UserSocialPage);
