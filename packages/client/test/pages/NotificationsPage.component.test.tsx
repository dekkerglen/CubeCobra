import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import NotificationType, { NotificationStatus } from '@utils/datatypes/Notification';

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

const renderPage = (notifications: NotificationType[], csrfFetch: jest.Mock = jest.fn()) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() }}>
      <NotificationsPage notifications={notifications} />
    </CSRFContext.Provider>,
  );

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
});
