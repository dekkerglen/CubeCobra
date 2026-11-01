import Notification, { NotificationStatus, NotificationType } from '@utils/datatypes/Notification';
import { groupNotifications, isNotificationGroup, NotificationDisplayEntry } from '@utils/notificationGrouping';

const n = (overrides: Partial<Notification> = {}): Notification => ({
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

// Follow notifications are keyed on the recipient, so every follow a user receives buckets together.
const follow = (id: string, status: NotificationStatus): Notification =>
  n({ id, status, type: NotificationType.FOLLOW, subject: 'u1', toStatusComp: `u1:${status}` });

const groupsOf = (entries: NotificationDisplayEntry[]) => entries.filter(isNotificationGroup);

describe('groupNotifications', () => {
  it('collapses a run of same-type, same-subject notifications', () => {
    const entries = groupNotifications([
      follow('n1', NotificationStatus.UNREAD),
      follow('n2', NotificationStatus.UNREAD),
    ]);

    expect(entries).toHaveLength(1);
    expect(groupsOf(entries)[0].count).toBe(2);
    expect(groupsOf(entries)[0].ids).toEqual(['n1', 'n2']);
  });

  it('counts how many members of a group are unread', () => {
    const entries = groupNotifications([
      follow('n1', NotificationStatus.UNREAD),
      follow('n2', NotificationStatus.UNREAD),
      follow('n3', NotificationStatus.READ),
    ]);

    expect(groupsOf(entries)[0].unreadCount).toBe(2);
  });

  it('reports no unread members once every member has been read', () => {
    const entries = groupNotifications([follow('n1', NotificationStatus.READ), follow('n2', NotificationStatus.READ)]);

    expect(groupsOf(entries)[0].unreadCount).toBe(0);
  });

  it('leaves singletons and untyped notifications ungrouped', () => {
    const entries = groupNotifications([follow('n1', NotificationStatus.UNREAD), n({ id: 'n2' })]);

    expect(entries).toHaveLength(2);
    expect(groupsOf(entries)).toHaveLength(0);
  });
});
