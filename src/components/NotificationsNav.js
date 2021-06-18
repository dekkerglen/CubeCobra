import React, { useState, useContext } from 'react';

import UserContext from 'contexts/UserContext';

import { UncontrolledDropdown, DropdownToggle, DropdownMenu, Badge, CardHeader, CardFooter } from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';
import LinkButton from 'components/LinkButton';

const NotificationsNav = () => {
  const user = useContext(UserContext);

  const [notifications, setNotifications] = useState(user.notifications);

  const clear = async () => {
    await csrfFetch('/user/clearnotifications', {
      method: 'POST',
    });
    setNotifications([]);
  };

  return (
    <UncontrolledDropdown nav inNavbar>
      <DropdownToggle nav caret>
        {notifications.length > 0 && (
          <Badge color="danger">{notifications.length > 100 ? '100+' : notifications.length}</Badge>
        )}
        <img className="notification-icon" src="/content/notification.png" alt="notifications" />
      </DropdownToggle>
      <DropdownMenu className="dropdown-no-green pb-0 mb-0" right>
        <CardHeader>
          <h6>
            Notifications
            {notifications.length > 0 && (
              <LinkButton className="card-subtitle float-right mt-0" onClick={clear}>
                Clear All
              </LinkButton>
            )}
          </h6>
        </CardHeader>
        <div className="sm-main-nav notification-scrollarea">
          {notifications.length > 0 ? (
            notifications.slice(0, 100).map((notification, index) => (
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

export default NotificationsNav;
