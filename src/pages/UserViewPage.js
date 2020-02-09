import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import CubePreview from 'components/CubePreview';
import UserLayout from 'layouts/UserLayout';

const UserViewPage = ({ user, followers, following, canEdit, cubes }) => (
  <UserLayout user={user} followers={followers} following={following} canEdit={canEdit} activeLink="view">
    <Card>
      <CardHeader>
        <h5 className="mb-0">About</h5>
      </CardHeader>
      <CardBody>
        {user.about ? user.about.trim().split(/[\r\n]+/).map((para) => <p>{para}</p>) : <em>This user has not yet filled out their about section.</em>}
      </CardBody>
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
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool.isRequired,
  about: PropTypes.string.isRequired,
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default UserViewPage;
