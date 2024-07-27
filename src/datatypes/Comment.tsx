export default interface Comment {
  id: string;
  parent: string;
  type: string;
  owner?: string;
  body: string;
  date: number;
  user?: {
    id: string;
    username: string;
  };
  image?: {
    uri: string;
    artist: string;
    id: string;
  };
}