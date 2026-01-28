import React, { useContext, useState } from 'react';

import { BellFillIcon } from '@primer/octicons-react';
import Notification from '@utils/datatypes/Notification';

import { CardFooter, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';

const NotificationsNav: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const [items, setItems] = useState<Notification[]>(user?.notifications || []);

  if (!user) {
    return null;
  }

  const clear = async () => {
    await csrfFetch('/user/clearnotifications', {
      method: 'POST',
    });
    setItems([]);
  };

  const label = (
    <>
      <span className="relative">
        {items.length > 0 && (
          <span
            className="absolute text-xs font-semibold text-white bg-button-danger rounded-full px-1 py-0.5 min-w-[1.25rem] text-center"
            style={{ right: '-3px', top: '-12px' }}
          >
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
        <BellFillIcon size={24} />
      </span>
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
