import React from 'react';
import PropTypes from 'prop-types';

import { Button, Nav, Navbar, NavItem, NavLink } from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';

const UserLayout = ({ user, followers, following, canEdit, activeLink, children }) => {
  return (
    <>
      <Nav tabs fill className="cubenav pt-2">
        <NavItem>
          <h5 href="#" style={{ color: '#218937' }}>
            {user.username}
          </h5>
          <h6 href="#">{followers} followers</h6>
          {!following && !canEdit && (
            <Button color="success" className="rounded-0 w-100" href={`/user/follow/${user._id}`}>
              Follow
            </Button>
          )}
          {following && !canEdit && (
            <Button color="danger" outline className="rounded-0 w-100" href={`/user/follow/${user._id}`}>
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
      </Nav>
      {canEdit && (
        <Navbar light className="usercontrols mb-3">
          <Nav navbar>
            <NavItem>
              <NavLink href="#" data-toggle="modal" data-target="#cubeModal">
                Create New Cube
              </NavLink>
            </NavItem>
          </Nav>
        </Navbar>
      )}
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
};

UserLayout.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.number.isRequired,
  following: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
};

UserLayout.defaultProps = {
  canEdit: false,
  children: false,
};

export default UserLayout;
