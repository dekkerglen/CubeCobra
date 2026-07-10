import Notification, { NotificationType } from './datatypes/Notification';

// A run of same-type/same-subject notifications collapsed into one display row.
export interface NotificationGroup {
  isGroup: true;
  type: NotificationType;
  subject: string;
  // The merged, human-readable text shown for the whole group (e.g. "There are 3 new drafts of My Cube").
  body: string;
  // Where clicking the group navigates to (the newest member's url).
  url?: string;
  // Number of notifications collapsed into this row.
  count: number;
  // The ids of every notification in the group, so a click can mark them all read.
  ids: string[];
  // Sort position: the newest member's date.
  date: number;
}

export type NotificationDisplayEntry = Notification | NotificationGroup;

export const isNotificationGroup = (entry: NotificationDisplayEntry): entry is NotificationGroup =>
  (entry as NotificationGroup).isGroup === true;

// A notification can only participate in grouping if it carries both a type and a subject.
const groupKeyOf = (n: Notification): string | null => (n.type && n.subject ? `${n.type}:${n.subject}` : null);

const mergedBody = (type: NotificationType, count: number, subjectName?: string): string => {
  const name = subjectName || 'your content';
  switch (type) {
    case NotificationType.DRAFT:
      return `There are ${count} new drafts of ${name}`;
    case NotificationType.COMMENT_REPLY:
      return `There are ${count} new replies to your ${name}`;
    case NotificationType.FOLLOW:
      return `${count} people followed you`;
    default:
      return `${count} new notifications`;
  }
};

/**
 * Collapses a list of notifications for display: runs of notifications that share the same type and
 * subject become a single group row ("There are 3 new drafts of My Cube"); everything else passes
 * through unchanged. Input is assumed to be sorted newest-first (as returned by the DAO); output
 * preserves that ordering, keying each group to its newest member.
 *
 * Pure and side-effect free so it can run on the server (page render) or the client (nav dropdown).
 */
export const groupNotifications = (notifications: Notification[]): NotificationDisplayEntry[] => {
  // First pass: bucket groupable notifications by type:subject.
  const buckets = new Map<string, Notification[]>();
  for (const n of notifications) {
    const key = groupKeyOf(n);
    if (key) {
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(n);
      } else {
        buckets.set(key, [n]);
      }
    }
  }

  // Second pass: walk the original order, emitting a group at the position of its newest member and
  // dropping the rest. Singletons (buckets of size 1) and untyped notifications stay as-is.
  const emitted = new Set<string>();
  const result: NotificationDisplayEntry[] = [];

  for (const n of notifications) {
    const key = groupKeyOf(n);

    if (!key) {
      result.push(n);
      continue;
    }

    const bucket = buckets.get(key)!;
    if (bucket.length < 2) {
      result.push(n);
      continue;
    }

    if (emitted.has(key)) {
      continue; // already represented by its group row
    }
    emitted.add(key);

    // The first time we hit the bucket in newest-first order, this notification is the newest member.
    result.push({
      isGroup: true,
      type: n.type!,
      subject: n.subject!,
      body: mergedBody(n.type!, bucket.length, n.subjectName),
      url: n.url,
      count: bucket.length,
      ids: bucket.map((item) => item.id),
      date: n.date,
    });
  }

  return result;
};
