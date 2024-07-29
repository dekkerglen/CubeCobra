export default interface BlogPost {
  id: string;
  body: string;
  owner: string;
  date: number;
  title?: string;
  cube: string;
  Changelog?: Partial<Changes>;
}
