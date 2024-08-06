import React, { useContext, useState } from 'react';
import { Badge, CardFooter, CardHeader, DropdownMenu, DropdownToggle, UncontrolledDropdown } from 'reactstrap';

import { BellFillIcon } from '@primer/octicons-react';

import LinkButton from 'components/LinkButton';
import UserContext from 'contexts/UserContext';
import { csrfFetch } from 'utils/CSRF';

const NotificationsNav = () => {
  const { notifications } = useContext(UserContext);

  const [items, setItems] = useState(notifications);

  const clear = async () => {
    await csrfFetch('/user/clearnotifications', {
      method: 'POST',
    });
    setItems([]);
  };

  return (
    <UncontrolledDropdown nav inNavbar>
      <DropdownToggle nav caret>
        {items.length > 0 && <Badge color="unsafe">{items.length > 30 ? '30+' : items.length}</Badge>}
        <span className="notification-wrapper">
          <BellFillIcon size={20} />
        </span>
      </DropdownToggle>
      <DropdownMenu className="dropdown-no-green pb-0 mb-0" end>
        <CardHeader>
          <h6>
            Notifications
            {items.length > 0 && (
              <LinkButton className="card-subtitle float-end mt-0" onClick={clear}>
                Clear All
              </LinkButton>
            )}
          </h6>
        </CardHeader>
        <div className="sm-main-nav notification-scrollarea">
          {items.length > 0 ? (
            items.map((notification) => (
              <div className="user-notification py-3 px-2">
                <a className="no-underline-hover" href={`/user/notification/${notification.id}`}>
                  <h6 className="card-subtitle">{notification.body}</h6>
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
