import React, { useContext, useState } from 'react';

import { NotificationGroup } from '@utils/notificationGrouping';

import Datetime from 'components/base/Datetime';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

interface NotificationGroupRowProps {
  group: NotificationGroup;
  // Compact styling for the navbar dropdown; the fuller layout is used on the notifications page.
  compact?: boolean;
}

// Renders a collapsed run of same-type notifications (e.g. "There are 3 new drafts of My Cube").
// Clicking marks every notification in the group read before navigating to the group's target.
const NotificationGroupRow: React.FC<NotificationGroupRowProps> = ({ group, compact }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [navigating, setNavigating] = useState(false);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (navigating) {
      return;
    }
    setNavigating(true);
    try {
      await csrfFetch('/user/marknotificationsread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: group.ids }),
      });
    } catch {
      // Navigate regardless; failing to mark read shouldn't trap the user on this row.
    } finally {
      window.location.href = group.url || '/';
    }
  };

  if (compact) {
    return (
      <a className="py-3 px-2 hover:bg-bg-active hover:cursor-pointer" href={group.url || '/'} onClick={handleClick}>
        {group.body}
      </a>
    );
  }

  return (
    <a className="no-underline-hover hover:cursor-pointer" href={group.url || '/'} onClick={handleClick}>
      <div className="hover:bg-bg-active pb-2 pt-3 px-2 deck-preview">
        <Text semibold sm>
          {group.body}
          {' - '}
          <Datetime date={group.date} />
        </Text>
      </div>
    </a>
  );
};

export default NotificationGroupRow;
