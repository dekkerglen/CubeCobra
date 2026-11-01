import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import NotificationType, {
  NotificationStatus,
  NotificationType as NotificationKind,
} from '@utils/datatypes/Notification';

import { CSRFContext } from 'contexts/CSRFContext';

import NotificationsPage from '../../src/pages/NotificationsPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
jest.mock('components/Banner', () => ({ __esModule: true, default: () => null }));

const n = (overrides: Partial<NotificationType> = {}): NotificationType => ({
  id: 'n1',
  to: 'u1',
  body: 'someone followed you',
  date: 1700000000000,
  dateCreated: 1700000000000,
  dateLastUpdated: 1700000000000,
  status: NotificationStatus.UNREAD,
  toStatusComp: `u1:${NotificationStatus.UNREAD}`,
  ...overrides,
});

// Follow notifications are keyed on the recipient, so every follow a user receives collapses into
// one group row — two followers is enough to make grouping the common case rather than the edge.
const follow = (id: string, status: NotificationStatus = NotificationStatus.UNREAD): NotificationType =>
  n({ id, status, type: NotificationKind.FOLLOW, subject: 'u1', toStatusComp: `u1:${status}` });

// A notification with neither type nor subject can't be grouped, so each one is its own display row.
const ungrouped = (index: number): NotificationType => n({ id: `u${index}`, body: `update ${index}` });

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body });

const renderPage = (notifications: NotificationType[], csrfFetch: jest.Mock = jest.fn(), lastKey?: string) =>
  render(
    <CSRFContext.Provider
      value={{
        csrfToken: 'token',
        csrfFetch,
        // Mirrors the real provider, where callApi is csrfFetch with a JSON POST body, so both of
        // the page's request paths stay observable through the single csrfFetch mock.
        callApi: (route, body) =>
          csrfFetch(route, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
      }}
    >
      <NotificationsPage notifications={notifications} lastKey={lastKey} />
    </CSRFContext.Provider>,
  );

// The pager's controls are icon-only, so the forward control is found by the octicon it renders.
const nextPageButton = (): HTMLButtonElement => {
  const found = Array.from(document.querySelectorAll('button')).find(
    (button) => button.querySelector('.octicon-arrow-right') && !button.disabled,
  );
  if (!found) {
    throw new Error('no enabled next-page control found');
  }
  return found;
};

const clickClearAll = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
  });
};

describe('NotificationsPage clear all', () => {
  it('marks every notification read without removing it from the list', async () => {
    const unread = n({ id: 'n1', body: 'someone followed you' });
    const csrfFetch = jest.fn().mockResolvedValue({ ok: true });
    renderPage([unread], csrfFetch);

    expect(screen.getByText('Unread')).toBeInTheDocument();

    await clickClearAll();

    expect(csrfFetch).toHaveBeenCalledWith('/user/clearnotifications', { method: 'POST' });
    // The endpoint only flips the status; the rows stay. Removing them would claim a deletion the
    // server never performed, and a reload would bring every one of them back.
    expect(screen.getByText(unread.body)).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    // ...and they have to visibly become read, or emptying-then-refilling the list would look the same.
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('marks every row read, not just the first', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({ ok: true });
    renderPage([n({ id: 'n1', body: 'first body' }), n({ id: 'n2', body: 'second body' })], csrfFetch);

    expect(screen.getAllByText('Unread')).toHaveLength(2);

    await clickClearAll();

    expect(screen.getByText('first body')).toBeInTheDocument();
    expect(screen.getByText('second body')).toBeInTheDocument();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('leaves the list alone when the request fails', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({ ok: false });
    renderPage([n({ id: 'n1', body: 'someone followed you' })], csrfFetch);

    await clickClearAll();

    expect(screen.getByText('someone followed you')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
  });

  it('offers nothing to clear when the list is empty', () => {
    renderPage([]);

    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('offers nothing to clear when every notification has already been read', () => {
    renderPage([n({ id: 'n1', status: NotificationStatus.READ, toStatusComp: `u1:${NotificationStatus.READ}` })]);

    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('still renders read notifications', () => {
    renderPage([n({ id: 'n1', body: 'old news', status: NotificationStatus.READ })]);

    expect(screen.getByText('old news')).toBeInTheDocument();
  });

  it('settles a collapsed run of unread notifications into the read state', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({ ok: true });
    renderPage([follow('n1'), follow('n2')], csrfFetch);

    // The run renders as a single group row, so the unread treatment has to reach that row or
    // clearing produces no visible change at all for the most common notification kind.
    expect(screen.getByText(/2 people followed you/)).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();

    await clickClearAll();

    expect(screen.getByText(/2 people followed you/)).toBeInTheDocument();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('leaves a collapsed run that has already been read alone', () => {
    renderPage([follow('n1', NotificationStatus.READ), follow('n2', NotificationStatus.READ)]);

    expect(screen.getByText(/2 people followed you/)).toBeInTheDocument();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('keeps rows read when a clear lands while more notifications are loading', async () => {
    let landMore: (value: unknown) => void = () => {};
    const morePending = new Promise((resolve) => {
      landMore = resolve;
    });
    const csrfFetch = jest.fn((url: string) =>
      url === '/user/clearnotifications' ? Promise.resolve({ ok: true }) : morePending,
    );

    renderPage([n({ id: 'n1', body: 'first body' })], csrfFetch, 'key-1');

    await act(async () => {
      fireEvent.click(nextPageButton());
    });

    await clickClearAll();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();

    await act(async () => {
      landMore({
        ok: true,
        json: async () => ({
          success: 'true',
          notifications: [n({ id: 'n2', body: 'second body', status: NotificationStatus.READ })],
          lastKey: undefined,
        }),
      });
      await morePending;
    });

    // The in-flight page merges into the live list, not the snapshot it was issued against, so the
    // statuses the clear just wrote survive.
    expect(screen.getByText('second body')).toBeInTheDocument();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });
});

describe('NotificationsPage pagination', () => {
  it('shows no pager when there are no notifications', () => {
    renderPage([]);

    expect(screen.getByText(/don't have any notifications/)).toBeInTheDocument();
    // A cursor list with nothing loaded has no page to honestly name; `Page 1 of 0` under the
    // empty-state message is the bug this replaces.
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('renders no loaded-record count in the header', () => {
    renderPage([ungrouped(1), ungrouped(2), ungrouped(3)]);

    // The old `(3)` reported how many records this browser session had fetched — a fact about
    // scroll history, not about the user's notifications.
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.queryByText(/Notifications \(/)).not.toBeInTheDocument();
  });

  it('labels the page without a denominator when more notifications remain', () => {
    renderPage([ungrouped(1)], jest.fn(), 'key-1');

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument();
  });

  it('counts grouped display rows, not raw notifications, for the page count', () => {
    const notifications = [
      ...Array.from({ length: 20 }, (_, i) => follow(`f${i}`)),
      ...Array.from({ length: 10 }, (_, i) =>
        n({ id: `d${i}`, type: NotificationKind.DRAFT, subject: 'cube-a', subjectName: 'Cube A' }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        n({ id: `c${i}`, type: NotificationKind.COMMENT_REPLY, subject: 'c1', subjectName: 'comment' }),
      ),
    ];

    renderPage(notifications);

    // 40 raw notifications, but only three display rows — well inside one page of 18.
    expect(screen.getByText(/20 people followed you/)).toBeInTheDocument();
    expect(screen.getByText(/There are 10 new drafts of Cube A/)).toBeInTheDocument();
    expect(screen.getByText(/There are 10 new replies to your comment/)).toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('keeps fetching until the requested page holds a full window of display rows', async () => {
    const csrfFetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: 'true',
          notifications: Array.from({ length: 10 }, (_, i) => ungrouped(i + 1)),
          lastKey: 'key-2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: 'true',
          notifications: Array.from({ length: 10 }, (_, i) => ungrouped(i + 11)),
          lastKey: undefined,
        }),
      );

    // 30 raw notifications that collapse into a single row, so counting items instead of rows
    // would call the second page full after one fetch and then render nothing on it.
    renderPage(
      Array.from({ length: 30 }, (_, i) => follow(`f${i}`)),
      csrfFetch,
      'key-1',
    );

    await act(async () => {
      fireEvent.click(nextPageButton());
    });

    expect(csrfFetch).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0);
    // 21 display rows: the group, then updates 1-20. Page two holds the last three.
    expect(screen.getByText('update 18')).toBeInTheDocument();
    expect(screen.getByText('update 20')).toBeInTheDocument();
    expect(screen.queryByText('update 17')).not.toBeInTheDocument();
  });

  it('stays put when a fetch returns notifications that add no display rows', async () => {
    const csrfFetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: 'true', notifications: [follow('n3'), follow('n4')], lastKey: undefined }),
      );

    renderPage([follow('n1'), follow('n2')], csrfFetch, 'key-1');

    await act(async () => {
      fireEvent.click(nextPageButton());
    });

    // The fetched notifications all collapse into the existing group, so advancing would land on
    // an empty page two.
    expect(screen.getByText(/4 people followed you/)).toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  // The footer pager sits inside a padded CardBody. When the pager renders nothing, that CardBody
  // is still visible chrome — a ~32px empty band hanging off the bottom of the card.
  it('renders no empty padded band under a list that fits one page', () => {
    const { container } = renderPage([ungrouped(1), ungrouped(2)]);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    const emptyPadded = Array.from(container.querySelectorAll('div.p-4')).filter(
      (element) => element.textContent === '',
    );
    expect(emptyPadded).toHaveLength(0);
  });

  it('still renders the footer pager when another page can be loaded', () => {
    const { container } = renderPage([ungrouped(1)], jest.fn(), 'key-1');

    const paddedFooters = Array.from(container.querySelectorAll('div.p-4'));
    expect(paddedFooters.length).toBeGreaterThan(0);
    expect(paddedFooters.every((element) => element.textContent !== '')).toBe(true);
  });
});
