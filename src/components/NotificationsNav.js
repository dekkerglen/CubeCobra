import React from 'react';
import PropTypes from 'prop-types';

import { UncontrolledDropdown, DropdownToggle, DropdownMenu, Badge, CardHeader, CardFooter } from 'reactstrap';

import LinkButton from 'components/LinkButton';

const NotificationsNav = ({ user }) => {
  return (
    <UncontrolledDropdown nav inNavbar>
      <DropdownToggle nav caret>
        {user.notifications.length > 0 && (
          <Badge color="danger">{user.notifications.length > 100 ? '100+' : user.notifications.length}</Badge>
        )}
        <img className="notification-icon" src="/content/notification.png" alt="notifications" />
      </DropdownToggle>
      <DropdownMenu className="dropdown-no-green pb-0 mb-0" right>
        <CardHeader>
          <h6>
            Notifications
            <LinkButton className="card-subtitle float-right mt-0">Clear All</LinkButton>
          </h6>
        </CardHeader>
        <div className="sm-main-nav notification-scrollarea">
          {user.notifications.length > 0 ? (
            user.notifications.slice(0, 100).map((notification, index) => (
              <div className="user-notification py-3 px-2">
                <a className="no-underline-hover" href={`/user/notification/${index}`}>
                  <h6 className="card-subtitle">{notification.text}</h6>
                </a>
              </div>
            ))
          ) : (
            <div className="my-2">
              <em className="mx-4">You don't have any notifications to show.</em>
            </div>
          )}
        </div>
        <CardFooter className="pb-1 pt-1">
          <h6>
            <a className="my-0 card-subtitle" href="/user/notifications">
              View Older Notifications
            </a>
          </h6>
        </CardFooter>
      </DropdownMenu>
    </UncontrolledDropdown>
  );
};

NotificationsNav.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

NotificationsNav.defaultProps = {
  user: {
    notifications: [],
  },
};

export default NotificationsNav;
