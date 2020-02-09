import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import AspectRatioBox from 'components/AspectRatioBox';
import CubePreview from 'components/CubePreview';

const UserPreview = ({ user }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  const handleClick = useCallback((event) => {
    window.location.href = event.currentTarget.getAttribute('data-href');
  }, []);
  const followers = user.users_following.length;
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      data-href={`/user/view/${user._id}`}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img className="w-100" src={user.image} />
        <em className="cube-preview-artist">Art by {user.artist}</em>
      </AspectRatioBox>
      <div className="w-100 py-1 px-2 text-muted text-truncate">
        <h5 className="mb-0">{user.username}</h5>
        {followers} {followers === 1 ? 'follower' : 'followers'}
      </div>
    </Card>
  );
};

UserPreview.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    users_following: PropTypes.arrayOf(PropTypes.string.isRequired),
  }).isRequired,
};

const UserSocialPage = ({ followedCubes, followedUsers }) => (
  <Row className="mt-3">
    <Col xs={6}>
      <Card>
        <CardHeader>
          <h5 className="mb-0">Followed Cubes</h5>
        </CardHeader>
        <CardBody className="p-0">
          <Row noGutters>
            {followedCubes.map((cube) => (
              <Col key={cube._id} xs={12} sm={6}>
                <CubePreview cube={cube} />
              </Col>
            ))}
          </Row>
        </CardBody>
      </Card>
    </Col>
    <Col xs={6}>
      <Card>
        <CardHeader>
          <h5 className="mb-0">Followed Users</h5>
        </CardHeader>
        <CardBody className="p-0">
          <Row noGutters>
            {followedUsers.map((user) => (
              <Col key={user._id} xs={12} sm={6}>
                <UserPreview user={user} />
              </Col>
            ))}
          </Row>
        </CardBody>
      </Card>
    </Col>
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
};

export default UserSocialPage;
