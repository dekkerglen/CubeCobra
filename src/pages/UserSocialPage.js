import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import CubePreview from 'components/CubePreview';
import UserPreview from 'components/UserPreview';

const UserSocialPage = ({ followedCubes, followedUsers, followers }) => (
  <Row className="mt-3">
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
              {followedUsers.map((user) => (
                <Col key={user._id} xs={12} sm={6}>
                  <UserPreview user={user} />
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
              {followers.map((user) => (
                <Col key={user._id} xs={6} sm={3}>
                  <UserPreview user={user} />
                </Col>
              ))}
            </Row>
          </CardBody>
        </Card>
      </Col>
    )}
  </Row>
);

UserSocialPage.propTypes = {
  followedCubes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
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
};

export default UserSocialPage;
