import React, { useContext } from 'react';
import { Button, Nav, Navbar, NavItem, NavLink, Row } from 'reactstrap';

import CreateCubeModal from 'components/CreateCubeModal';
import ErrorBoundary from 'components/ErrorBoundary';
import FollowersModal from 'components/FollowersModal';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import User from 'datatypes/User';

interface UserLayoutProps {
  user: User;
  followers: User[];
  following: boolean;
  activeLink: string;
  children?: React.ReactNode;
}

const FollowersModalLink = withModal('a', FollowersModal);
const CreateCubeModalLink = withModal(NavLink, CreateCubeModal);

const UserLayout: React.FC<UserLayoutProps> = ({ user, followers, following, activeLink, children }) => {
  const activeUser = useContext(UserContext)!;
  const canEdit = activeUser && activeUser.id === user.id;

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
          <h5 style={{ color: '#218937' }}>{user.username}</h5>
          {numFollowers > 0 ? (
            <FollowersModalLink href="#" modalprops={{ followers }}>
              {followersText}
            </FollowersModalLink>
          ) : (
            followersText
          )}
          {!following && !canEdit && (
            <Button color="accent" className="rounded-0 w-100" href={`/user/follow/${user.id}`}>
              Follow
            </Button>
          )}
          {following && !canEdit && (
            <Button color="unsafe" outline className="rounded-0 w-100" href={`/user/unfollow/${user.id}`}>
              Unfollow
            </Button>
          )}
        </NavItem>
        <NavItem className="px-2 align-self-end">
          <NavLink active={activeLink === 'view'} href={`/user/view/${user.id}`}>
            Cubes
          </NavLink>
        </NavItem>
        <NavItem className="px-2 align-self-end">
          <NavLink active={activeLink === 'decks'} href={`/user/decks/${user.id}`}>
            Decks
          </NavLink>
        </NavItem>
        <NavItem className="px-2 align-self-end">
          <NavLink active={activeLink === 'blog'} href={`/user/blog/${user.id}`}>
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

export default UserLayout;
