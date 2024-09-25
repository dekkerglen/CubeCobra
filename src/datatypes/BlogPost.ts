import { Changes } from 'datatypes/Card';

export default interface BlogPost {
  id: string;
  body: string;
  owner: string;
  date: number;
  title?: string;
  cube: string;
  cubeName: string;
  Changelog?: Partial<Changes>;
}
