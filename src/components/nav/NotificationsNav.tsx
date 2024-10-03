import React, { useContext, useState } from 'react';
import { BellFillIcon } from '@primer/octicons-react';
import LinkButton from 'components/base/LinkButton';
import UserContext from 'contexts/UserContext';
import { csrfFetch } from 'utils/CSRF';
import { Notification } from 'datatypes/Notification';
import Badge from 'components/base/Badge';
import { CardHeader, CardFooter } from 'components/base/Card';
import NavMenu from 'components/base/NavMenu';
import { Flexbox } from 'components/base/Layout';
import { NavLink } from 'reactstrap';

const NotificationsNav: React.FC = () => {
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
      {items.length > 0 && <Badge color="danger">{items.length > 30 ? '30+' : items.length}</Badge>}
      <BellFillIcon size={20} className="ml-1" />
    </>
  );

  return (
    <NavMenu label={label} wide>
      <Flexbox direction="col">
        <CardHeader>
          <Flexbox justify="between" direction="row" className="font-semibold">
            Notifications
            <LinkButton className="card-subtitle float-end mt-0" onClick={clear}>
              Clear All
            </LinkButton>
          </Flexbox>
        </CardHeader>
        <Flexbox direction="col" className="max-h-96 overflow-auto">
          {items.length > 0 ? (
            items.map((notification) => (
              <a
                className="py-3 px-2 hover:bg-bg-active hover:cursor-pointer"
                href={`/user/notification/${notification.id}`}
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
          <NavLink href="/user/notifications">View Older Notifications</NavLink>
        </CardFooter>
      </Flexbox>
    </NavMenu>
  );
};

export default NotificationsNav;
