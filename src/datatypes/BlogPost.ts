import { Changes } from 'datatypes/Card';
import Commentable from './Commentable';
import User from './User';

export default interface BlogPost extends Commentable {
  id: string;
  body: string;
  owner: string | User;
  date: number;
  title?: string;
  cube: string;
  cubeName: string;
  Changelog?: Partial<Changes>;
}
