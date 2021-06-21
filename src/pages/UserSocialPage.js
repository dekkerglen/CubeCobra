import React from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import CubePreview from 'components/CubePreview';
import UserPreview from 'components/UserPreview';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const UserSocialPage = ({ user, followedCubes, followedUsers, followers, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Banner user={user} />
    <DynamicFlash />
    <Row className="my-3">
      <Col xs={6}>
        <Card>
          <CardHeader>
            <h5 className="mb-0">Followed Cubes</h5>
          </CardHeader>
          {followedCubes.length > 0 ? (
            <CardBody className="p-0">
              <Row noGutters>
                {followedCubes.map((cube) => (
                  <Col key={cube._id} xs={12} sm={6}>
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
              <Row noGutters>
                {followedUsers.map((item) => (
                  <Col key={item._id} xs={12} sm={6}>
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
              <Row noGutters>
                {followers.map((item) => (
                  <Col key={item._id} xs={6} sm={3}>
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
  followedUsers: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  followers: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

UserSocialPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(UserSocialPage);
