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

const renderPage = (notifications: NotificationType[], csrfFetch: jest.Mock = jest.fn(), lastKey?: string) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() }}>
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
    expect(screen.getByText(/Notifications \(1\)/)).toBeInTheDocument();
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
