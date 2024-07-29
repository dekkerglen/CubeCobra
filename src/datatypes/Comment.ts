import User from './User';

export default interface Comment {
  id: string;
  parent: string;
  type: string;
  owner: User;
  body: string;
  date: number;
  image?: {
    id: string;
    uri: string;
    artist: string;
    imageName: string;
  };
}
