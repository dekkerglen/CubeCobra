import { BaseObject } from './BaseObject';

export enum NotificationStatus {
  READ = 'r',
  UNREAD = 'u',
}

// Only notifications that are worth collapsing when several of the same kind pile up carry a type.
// Untyped notifications always render individually.
export enum NotificationType {
  DRAFT = 'draft', // someone drafted your cube; grouped by cube
  COMMENT_REPLY = 'comment_reply', // someone replied to your comment/blog/deck/etc; grouped by parent
  FOLLOW = 'follow', // someone followed you; grouped by followed user
}

export type NewNotification = {
  date: number;
  to: string;
  from?: string;
  url?: string;
  body: string;
  fromUsername?: string;
  // Grouping metadata. `type` + `subject` together identify notifications that can be merged for
  // display; `subjectName` is the human label for the subject (e.g. cube name, "blog post").
  type?: NotificationType;
  subject?: string;
  subjectName?: string;
};

type Notification = NewNotification &
  BaseObject & {
    id: string;
    status: NotificationStatus;
    toStatusComp: string;
  };

export default Notification;
