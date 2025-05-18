export enum NotificationStatus {
  READ = 'r',
  UNREAD = 'u',
}

export type NewNotification = {
  date: number;
  to: string;
  from?: string;
  url?: string;
  body: string;
  fromUsername?: string;
};

export type Notification = Omit<NewNotification, 'id'> & {
  id: string;
  status: NotificationStatus;
  toStatusComp: string;
};

export default Notification;
