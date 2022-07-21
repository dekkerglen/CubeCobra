import React, { useState } from 'react';

import { UncontrolledDropdown, DropdownToggle, DropdownMenu, Badge, CardHeader, CardFooter } from 'reactstrap';

import { BellFillIcon } from '@primer/octicons-react';
import { csrfFetch } from 'utils/CSRF';
import LinkButton from 'components/LinkButton';
import useMount from 'hooks/UseMount';

const NotificationsNav = () => {
  const [items, setItems] = useState([]);

  useMount(() => {
    const fetch = async () => {
      const response = await csrfFetch(`/user/getusernotifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lastKey: null,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          setItems([...items, ...json.notifications]);
        }
      }
    };
    fetch();
  });

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
                <a className="no-underline-hover" href={`/user/notification/${notification.Id}`}>
                  <h6 className="card-subtitle">{notification.Body}</h6>
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
