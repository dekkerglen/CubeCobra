import React, { useCallback, useContext, useMemo, useState } from 'react';

import NotificationType, { NotificationStatus } from '@utils/datatypes/Notification';
import { groupNotifications, isNotificationGroup } from '@utils/notificationGrouping';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import Notification from 'components/nav/Notification';
import NotificationGroupRow from 'components/nav/NotificationGroupRow';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface NotificationsPageProps {
  notifications: NotificationType[];
  lastKey?: string;
}

const PAGE_SIZE = 18;

const NotificationsPage: React.FC<NotificationsPageProps> = ({ notifications, lastKey }) => {
  const [items, setItems] = useState<NotificationType[]>(notifications);
  const { csrfFetch } = useContext(CSRFContext);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  // Collapse runs of same-type/same-subject notifications into single rows for display, then paginate
  // over the collapsed list so a group counts as one entry.
  const entries = useMemo(() => groupNotifications(items), [items]);

  const pageCount = Math.ceil(entries.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;
  const hasUnread = items.some((item) => item.status === NotificationStatus.UNREAD);

  // The endpoint flips UNREAD to READ and deletes nothing, and this page lists notifications
  // regardless of status — so the rows stay put and change appearance. Dropping them would claim a
  // deletion that never happened, and the next page load would bring every one of them back.
  const clearAll = useCallback(async () => {
    const response = await csrfFetch('/user/clearnotifications', { method: 'POST' });
    if (response.ok) {
      setItems((current) => current.map((item) => ({ ...item, status: NotificationStatus.READ })));
    }
  }, [csrfFetch]);

  const fetchMoreData = useCallback(async () => {
    setLoading(true);
    const response = await csrfFetch(`/user/getmorenotifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        const newItems = [...items, ...json.notifications];
        setItems(newItems);
        // Grouping collapses runs of same-type/same-subject notifications, so a fetch may add fewer
        // (or zero) new display entries than raw notifications. Clamp the advance to the last valid
        // page so we never scroll past the end and render a blank list.
        const newPageCount = Math.ceil(groupNotifications(newItems).length / PAGE_SIZE);
        setPage(Math.min(page + 1, Math.max(0, newPageCount - 1)));
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [csrfFetch, currentLastKey, items, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        if (newPage >= pageCount) {
          await fetchMoreData();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );
  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
            <Text lg semibold>
              Notifications ({items.length}
              {hasMore ? '+' : ''})
            </Text>
            {hasUnread && (
              <Button color="primary" onClick={clearAll}>
                Clear All
              </Button>
            )}
            {items.length > 0 && pager}
          </Flexbox>
        </CardHeader>
        {entries.length > 0 ? (
          entries
            .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
            .map((entry) =>
              isNotificationGroup(entry) ? (
                <NotificationGroupRow key={`${entry.type}:${entry.subject}`} group={entry} />
              ) : (
                <Notification key={entry.id} notification={entry} />
              ),
            )
        ) : (
          <p className="m-2">
            You don't have any notifications! Why don't you try sharing your cube on the{' '}
            <a href="https://discord.gg/YYF9x65Ane">Cube Cobra Discord?</a>
          </p>
        )}
        <CardBody>
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
            {pager}
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(NotificationsPage);
