import { Changes } from 'datatypes/Card';
import Commentable from './Commentable';

export default interface BlogPost extends Commentable {
  id: string;
  body: string;
  owner: string;
  date: number;
  title?: string;
  cube: string;
  cubeName: string;
  Changelog?: Partial<Changes>;
}
