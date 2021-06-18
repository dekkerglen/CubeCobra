import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import UserContext from 'contexts/UserContext';

import ErrorBoundary from 'components/ErrorBoundary';
import FollowersModal from 'components/FollowersModal';
import withModal from 'components/WithModal';
import CreateCubeModal from 'components/CreateCubeModal';

import { Button, Nav, Navbar, NavItem, NavLink, Row } from 'reactstrap';

const FollowersModalLink = withModal('a', FollowersModal);
const CreateCubeModalLink = withModal(NavLink, CreateCubeModal);

const UserLayout = ({ user, followers, following, activeLink, children }) => {
  const activeUser = useContext(UserContext);
  const canEdit = activeUser.id === user._id;

  const numFollowers = followers.length;
  const followersText = (
    <h6>
      {numFollowers} {numFollowers === 1 ? 'follower' : 'followers'}
    </h6>
  );
  return (
    <>
      <Nav tabs fill className="cubenav pt-2">
        <NavItem>
          <h5 href="#" style={{ color: '#218937' }}>
            {user.username}
          </h5>
          {numFollowers > 0 ? (
            <FollowersModalLink href="#" modalProps={{ followers }}>
              {followersText}
            </FollowersModalLink>
          ) : (
            followersText
          )}
          {!following && !canEdit && (
            <Button color="success" className="rounded-0 w-100" href={`/user/follow/${user._id}`}>
              Follow
            </Button>
          )}
          {following && !canEdit && (
            <Button color="danger" outline className="rounded-0 w-100" href={`/user/unfollow/${user._id}`}>
              Unfollow
            </Button>
          )}
        </NavItem>
        <NavItem className="px-2 align-self-end">
          <NavLink active={activeLink === 'view'} href={`/user/view/${user._id}`}>
            Cubes
          </NavLink>
        </NavItem>
        <NavItem className="px-2 align-self-end">
          <NavLink active={activeLink === 'decks'} href={`/user/decks/${user._id}`}>
            Decks
          </NavLink>
        </NavItem>
        <NavItem className="px-2 align-self-end">
          <NavLink active={activeLink === 'blog'} href={`/user/blog/${user._id}`}>
            Blog
          </NavLink>
        </NavItem>
      </Nav>
      {canEdit && (
        <Navbar light className="usercontrols">
          <Nav navbar>
            <NavItem>
              <CreateCubeModalLink>Create New Cube</CreateCubeModalLink>
            </NavItem>
          </Nav>
        </Navbar>
      )}
      <Row className="mb-3" />
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
};

UserLayout.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
};

UserLayout.defaultProps = {
  children: false,
};

export default UserLayout;
