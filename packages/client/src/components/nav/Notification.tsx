import React from 'react';

import TimeAgo from 'react-timeago';

import Link from 'components/base/Link';
import Text from 'components/base/Text';
import NotificationType from '@utils/datatypes/Notification';

interface NotificationProps {
  notification: NotificationType;
}

const Notification: React.FC<NotificationProps> = ({ notification }) => {
  const texts = notification.body.split(notification.fromUsername || '');
  return (
    <a className="no-underline-hover" href={`/user/notification/${notification.id}`}>
      <div className="hover:bg-bg-active pb-2 pt-3 px-2 deck-preview">
        <Text semibold sm>
          <Link href={`/user/notification/${notification.id}`}>{texts[0]}</Link>
          {notification.from ? (
            <Link href={`/user/view/${notification.from}`}>{notification.fromUsername}</Link>
          ) : (
            notification.fromUsername
          )}
          <Link href={`/user/notification/${notification.id}`}>{texts[1]}</Link>
          {' - '}
          <TimeAgo date={notification.date} />
        </Text>
      </div>
    </a>
  );
};

export default Notification;
