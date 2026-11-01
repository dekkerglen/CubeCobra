import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';

import NotificationType, { NotificationStatus } from '@utils/datatypes/Notification';
import { groupNotifications, isNotificationGroup } from '@utils/notificationGrouping';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import CursorPagination, { willRenderCursorPager } from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import Notification from 'components/nav/Notification';
import NotificationGroupRow from 'components/nav/NotificationGroupRow';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

interface NotificationsPageProps {
  notifications: NotificationType[];
  lastKey?: string;
}

const PAGE_SIZE = 18;

const NotificationsPage: React.FC<NotificationsPageProps> = ({ notifications, lastKey }) => {
  const [items, setItems] = useState<NotificationType[]>(notifications);
  const { csrfFetch, callApi } = useContext(CSRFContext);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  // Mirrors `items` so the async handlers below apply their change to the live list rather than to
  // whichever snapshot they closed over: a clear-all and a page fetch can be in flight together,
  // and whichever landed second would otherwise discard the other's work.
  const itemsRef = useRef<NotificationType[]>(notifications);
  const updateItems = useCallback((update: (current: NotificationType[]) => NotificationType[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  // Collapse runs of same-type/same-subject notifications into single rows for display, then paginate
  // over the collapsed list so a group counts as one entry.
  const entries = useMemo(() => groupNotifications(items), [items]);

  const pageCount = getIndefinitePageCount(entries, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);
  const hasUnread = items.some((item) => item.status === NotificationStatus.UNREAD);

  // The endpoint flips UNREAD to READ and deletes nothing, and this page lists notifications
  // regardless of status — so the rows stay put and change appearance. Dropping them would claim a
  // deletion that never happened, and the next page load would bring every one of them back.
  const clearAll = useCallback(async () => {
    const response = await csrfFetch('/user/clearnotifications', { method: 'POST' });
    if (response.ok) {
      updateItems((current) => current.map((item) => ({ ...item, status: NotificationStatus.READ })));
    }
  }, [csrfFetch, updateItems]);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      // The helper only ever appends to the list it was handed, so everything past this snapshot's
      // length is newly fetched. Merging just that tail back through updateItems keeps the statuses
      // a concurrent clear-all wrote, which committing the helper's whole array would overwrite.
      const snapshot = itemsRef.current;

      await fetchIndefiniteMoreData<NotificationType>({
        callApi,
        fetchMoreRoute: '/user/getmorenotifications',
        items: snapshot,
        setItems: (next) => {
          const fetched = next.slice(snapshot.length);
          updateItems((current) => [...current, ...fetched]);
        },
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'notifications',
        setLoading,
        targetPage,
        // Grouping collapses runs of same-type/same-subject notifications, so a fetch may add fewer
        // (or zero) display entries than raw notifications. The loop has to fill the page window
        // with rows, and clamp the advance to the rows that actually exist, or the user lands on a
        // blank page.
        countRows: (current) => groupNotifications(current).length,
      });
    },
    [callApi, currentLastKey, updateItems],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData,
        });
      }}
      loading={loading}
    />
  );

  // The footer's padded CardBody is visible chrome of its own, so it has to appear on exactly the
  // condition the pager does — otherwise a one-page list ends in an empty padded band.
  const showPager = willRenderCursorPager(pageCount, hasMore);

  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
            <Text lg semibold>
              Notifications
            </Text>
            {hasUnread && (
              <Button color="primary" onClick={clearAll}>
                Clear All
              </Button>
            )}
            {pager}
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
        {showPager && (
          <CardBody>
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </CardBody>
        )}
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(NotificationsPage);
