import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import NotificationType, { NotificationStatus } from '@utils/datatypes/Notification';

import Notification from 'components/nav/Notification';

const n = (overrides: Partial<NotificationType> = {}): NotificationType => ({
  id: 'n1',
  to: 'u1',
  from: 'u2',
  fromUsername: 'sender',
  body: 'sender followed you',
  date: 1700000000000,
  dateCreated: 1700000000000,
  dateLastUpdated: 1700000000000,
  status: NotificationStatus.UNREAD,
  toStatusComp: `u1:${NotificationStatus.UNREAD}`,
  ...overrides,
});

describe('Notification', () => {
  it('distinguishes an unread notification from a read one', () => {
    const { container: unread } = render(<Notification notification={n({ status: NotificationStatus.UNREAD })} />);
    const { container: read } = render(<Notification notification={n({ status: NotificationStatus.READ })} />);

    expect(unread.innerHTML).not.toEqual(read.innerHTML);
  });

  it('announces an unread notification as unread', () => {
    render(<Notification notification={n({ status: NotificationStatus.UNREAD })} />);

    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('says nothing about unread on a notification that has been read', () => {
    render(<Notification notification={n({ status: NotificationStatus.READ })} />);

    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('renders the whole body when the notification has no sender', () => {
    render(
      <Notification notification={n({ body: 'Your cube was drafted', fromUsername: undefined, from: undefined })} />,
    );

    expect(screen.getByText(/Your cube was drafted/)).toBeInTheDocument();
  });

  it('renders the whole body when the notification has a sender', () => {
    render(<Notification notification={n({ body: 'sender followed you', fromUsername: 'sender' })} />);

    expect(screen.getByText(/sender followed you/)).toBeInTheDocument();
  });

  it('does not nest one link inside another', () => {
    const { container } = render(<Notification notification={n()} />);

    expect(container.querySelector('a a')).toBeNull();
  });

  it('points the row at the notification', () => {
    const { container } = render(<Notification notification={n({ id: 'abc' })} />);

    const anchors = Array.from(container.querySelectorAll('a'));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toHaveAttribute('href', '/user/notification/abc');
  });
});
