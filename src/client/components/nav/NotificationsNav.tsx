import React, { useContext, useState } from 'react';

import { BellFillIcon } from '@primer/octicons-react';

import Badge from 'components/base/Badge';
import { CardFooter, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import Notification from 'datatypes/Notification';

const NotificationsNav: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);

  if (!user) {
    return null;
  }
  const [items, setItems] = useState<Notification[]>(user.notifications || []);

  const clear = async () => {
    await csrfFetch('/user/clearnotifications', {
      method: 'POST',
    });
    setItems([]);
  };

  const label = (
    <>
      {items.length > 0 && <Badge color="danger">{items.length > 99 ? '99+' : items.length}</Badge>}
      <BellFillIcon size={20} className="ml-1" />
    </>
  );

  return (
    <NavMenu label={label} wide navBar>
      <Flexbox direction="col">
        <CardHeader>
          <Flexbox justify="between" direction="row" className="font-semibold">
            Notifications
            <Link className="card-subtitle float-end mt-0" onClick={clear}>
              Clear All
            </Link>
          </Flexbox>
        </CardHeader>
        <Flexbox direction="col" className="max-h-96 overflow-auto">
          {items.length > 0 ? (
            items.map((notification) => (
              <a
                className="py-3 px-2 hover:bg-bg-active hover:cursor-pointer"
                href={`/user/notification/${notification.id}`}
                key={notification.id}
              >
                {notification.body}
              </a>
            ))
          ) : (
            <div className="my-2">
              <em className="mx-4">You don't have any notifications to show.</em>
            </div>
          )}
        </Flexbox>
        <CardFooter className="pb-1 pt-1 font-semibold">
          <Link href="/user/notifications">View Older Notifications</Link>
        </CardFooter>
      </Flexbox>
    </NavMenu>
  );
};

export default NotificationsNav;
