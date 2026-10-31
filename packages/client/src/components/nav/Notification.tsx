import React from 'react';

import classNames from 'classnames';

import NotificationType, { NotificationStatus } from '@utils/datatypes/Notification';

import Datetime from 'components/base/Datetime';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

interface NotificationProps {
  notification: NotificationType;
}

const Notification: React.FC<NotificationProps> = ({ notification }) => {
  const unread = notification.status === NotificationStatus.UNREAD;

  return (
    // One link for the whole row, as in NotificationGroupRow. The body already names the sender, so
    // linking that name separately would nest an anchor inside this one.
    <a className="no-underline-hover hover:cursor-pointer" href={`/user/notification/${notification.id}`}>
      <div className={classNames('hover:bg-bg-active pb-2 pt-3 px-2 deck-preview', { 'bg-bg-active/50': unread })}>
        <Flexbox direction="row" gap="2" alignItems="start">
          {/* Always rendered so read and unread bodies share a left edge; only the fill differs. */}
          <span
            aria-hidden="true"
            className={classNames('mt-1 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-button-danger' : 'bg-transparent')}
          />
          <Text sm semibold={unread} className={unread ? '' : 'text-text-secondary'}>
            {/* The dot carries no accessible name of its own. */}
            {unread && <span className="sr-only">Unread</span>}
            <span>{notification.body}</span>
            {' - '}
            <Datetime date={notification.date} />
          </Text>
        </Flexbox>
      </div>
    </a>
  );
};

export default Notification;
