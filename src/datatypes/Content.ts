import User from './User';

export const CONVERT_STATUS = {
  p: 'Published',
  r: 'In Review',
  d: 'Draft',
};

export default interface Content {
  id: string;
  date: number;
  status: 'p' | 'r' | 'd';
  owner: User;
  type: string;
  typeStatusComp: string;
  typeOwnerComp: string;
  title?: string;
  body?: string;
  short?: string;
  url?: string;
  username?: string;
}
