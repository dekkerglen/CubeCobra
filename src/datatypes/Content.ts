import User from './User';
export default interface Content {
  id: string;
  date: number;
  status: string;
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
