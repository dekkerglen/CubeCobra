import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { NotificationType } from '@utils/datatypes/Notification';
import { NotificationGroup } from '@utils/notificationGrouping';

import NotificationGroupRow from 'components/nav/NotificationGroupRow';
import { CSRFContext } from 'contexts/CSRFContext';

const group = (overrides: Partial<NotificationGroup> = {}): NotificationGroup => ({
  isGroup: true,
  type: NotificationType.FOLLOW,
  subject: 'u1',
  body: '3 people followed you',
  url: '/user/view/u1',
  count: 3,
  ids: ['n1', 'n2', 'n3'],
  unreadCount: 3,
  date: 1700000000000,
  ...overrides,
});

const renderRow = (value: NotificationGroup, compact = false) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: jest.fn(), callApi: jest.fn() }}>
      <NotificationGroupRow group={value} compact={compact} />
    </CSRFContext.Provider>,
  );

describe('NotificationGroupRow', () => {
  it('distinguishes a group with unread members from one with none', () => {
    const { container: unread } = renderRow(group({ unreadCount: 3 }));
    const { container: read } = renderRow(group({ unreadCount: 0 }));

    expect(unread.innerHTML).not.toEqual(read.innerHTML);
  });

  it('announces a group with unread members as unread', () => {
    renderRow(group({ unreadCount: 1 }));

    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('says nothing about unread once every member has been read', () => {
    renderRow(group({ unreadCount: 0 }));

    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('renders the merged body', () => {
    renderRow(group({ body: '3 people followed you' }));

    expect(screen.getByText(/3 people followed you/)).toBeInTheDocument();
  });

  it('points the row at the group target', () => {
    const { container } = renderRow(group({ url: '/user/view/u1' }));

    const anchors = Array.from(container.querySelectorAll('a'));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toHaveAttribute('href', '/user/view/u1');
  });
});
