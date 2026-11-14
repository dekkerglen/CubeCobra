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

  it('keeps read notifications out of an unread group', () => {
    const entries = groupNotifications([
      follow('n1', NotificationStatus.UNREAD),
      follow('n2', NotificationStatus.UNREAD),
      follow('n3', NotificationStatus.READ),
    ]);

    expect(entries).toHaveLength(2);
    expect(groupsOf(entries)[0].count).toBe(2);
    expect(groupsOf(entries)[0].unreadCount).toBe(2);
    expect(entries[1]).toMatchObject({ id: 'n3' });
  });

  it('does not group a single unread notification with an already-read one', () => {
    const draft = (id: string, status: NotificationStatus) =>
      n({ id, status, type: NotificationType.DRAFT, subject: 'cube1', subjectName: 'My Cube' });
    const entries = groupNotifications([draft('d2', NotificationStatus.UNREAD), draft('d1', NotificationStatus.READ)]);

    expect(entries).toHaveLength(2);
    expect(groupsOf(entries)).toHaveLength(0);
  });

  it('reports no unread members once every member has been read', () => {
    const entries = groupNotifications([follow('n1', NotificationStatus.READ), follow('n2', NotificationStatus.READ)]);

    expect(groupsOf(entries)[0].unreadCount).toBe(0);
  });

  it('links a group of drafts to the cube drafts list instead of the newest draft', () => {
    const draft = (id: string) =>
      n({ id, type: NotificationType.DRAFT, subject: 'cube1', subjectName: 'My Cube', url: `/cube/deck/${id}` });
    const entries = groupNotifications([draft('d1'), draft('d2')]);

    expect(groupsOf(entries)[0].url).toBe('/cube/playtest/cube1?view=decks');
  });

  it('leaves singletons and untyped notifications ungrouped', () => {
    const entries = groupNotifications([follow('n1', NotificationStatus.UNREAD), n({ id: 'n2' })]);

    expect(entries).toHaveLength(2);
    expect(groupsOf(entries)).toHaveLength(0);
  });
});
