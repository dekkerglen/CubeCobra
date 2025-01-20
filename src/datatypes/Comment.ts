import { CubeImage } from './Cube';
import User from './User';

export type UnhydratedComment = {
  id?: string;
  parent: string;
  type: string;
  owner?: string;
  body: string;
  date: number;
};

type Comment = Omit<UnhydratedComment, 'id' | 'owner'> & {
  id: string;
  owner: User;
  image?: CubeImage;
};

export default Comment;
