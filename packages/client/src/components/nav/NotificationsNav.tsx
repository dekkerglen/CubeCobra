import React, { useContext, useState } from 'react';

import { BellFillIcon } from '@primer/octicons-react';
import Notification from '@utils/datatypes/Notification';
import { groupNotifications, isNotificationGroup } from '@utils/notificationGrouping';

import { CardFooter, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
import NotificationGroupRow from 'components/nav/NotificationGroupRow';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';

interface NotificationsNavProps {
  transparent?: boolean;
}

const NotificationsNav: React.FC<NotificationsNavProps> = ({ transparent = false }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const [items, setItems] = useState<Notification[]>(user?.notifications || []);

  if (!user) {
    return null;
  }

  // Collapse repeats (e.g. several drafts of the same cube) into single rows for the dropdown.
  const entries = groupNotifications(items);

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
            style={{ right: '-7px', top: '-12px' }}
          >
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
        <BellFillIcon size={24} />
      </span>
    </>
  );

  return (
    <NavMenu label={label} wide navBar noChevron transparent={transparent}>
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
          {entries.length > 0 ? (
            entries.map((entry) =>
              isNotificationGroup(entry) ? (
                <NotificationGroupRow key={`${entry.type}:${entry.subject}`} group={entry} compact />
              ) : (
                <a
                  className="py-3 px-2 hover:bg-bg-active hover:cursor-pointer"
                  href={`/user/notification/${entry.id}`}
                  key={entry.id}
                >
                  {entry.body}
                </a>
              ),
            )
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
