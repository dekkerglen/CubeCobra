import User from './User';

export enum NoticeType {
  APPLICATION = 'a',
  COMMENT_REPORT = 'cr',
  CUBE_REPORT = 'cur',
}

export enum NoticeStatus {
  ACTIVE = 'a',
  PROCESSED = 'p',
}

export type NewNotice = {
  id?: string;
  date: number;
  user: string | null;
  body: string;
  type: NoticeType;
  subject?: string;
};

//The information loaded from Dynamo
export type UnhydratedNotice = NewNotice & {
  status: NoticeStatus;
  dateCreated: number;
  dateLastUpdated: number;
};

export type Notice = Omit<UnhydratedNotice, 'id' | 'user'> & {
  id: string;
  user: User;
  dateCreated: number;
  dateLastUpdated: number;
};
