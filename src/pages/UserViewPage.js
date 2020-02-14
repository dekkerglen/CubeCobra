import React from 'react';
import PropTypes from 'prop-types';

import { Button, Card, CardBody, CardFooter, CardHeader, Col, Row } from 'reactstrap';

import CubePreview from 'components/CubePreview';
import UserLayout from 'layouts/UserLayout';

const UserViewPage = ({ user, followers, following, canEdit, cubes }) => (
  <UserLayout user={user} followers={followers} following={following} canEdit={canEdit} activeLink="view">
    <Card>
      <CardHeader>
        <h5 className="mb-0">About</h5>
      </CardHeader>
      <CardBody>
        <Row>
          {user.image && (
            <Col xs={4} lg={3}>
              <div className="position-relative">
                <img width="100%" className="border" src={user.image} alt={user.image_name} />
                <em className="cube-preview-artist">Art by {user.artist}</em>
              </div>
            </Col>
          )}
          <Col xs={user.image ? 8 : 12} lg={user.image ? 9 : 12}>
            {user.about ? (
              user.about
                .trim()
                .split(/[\r\n]+/)
                .map((para, index) => (
                  <p key={/* eslint-disable-line react/no-array-index-key */ index} className="my-0">
                    {para}
                  </p>
                ))
            ) : (
              <em>This user has not yet filled out their about section.</em>
            )}
          </Col>
        </Row>
      </CardBody>
      {canEdit && (
        <CardFooter>
          <Button color="success" href="/user/account">
            Update
          </Button>
        </CardFooter>
      )}
    </Card>
    <Row>
      {cubes.map((cube) => (
        <Col key={cube._id} className="mt-3" xs={4} sm={3}>
          <CubePreview cube={cube} />
        </Col>
      ))}
    </Row>
  </UserLayout>
);

UserViewPage.propTypes = {
  user: PropTypes.shape({
    about: PropTypes.string.isRequired,
    image_name: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool.isRequired,
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default UserViewPage;
