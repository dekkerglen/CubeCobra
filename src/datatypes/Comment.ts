import { CubeImage } from './Cube';
import User from './User';

export default interface Comment {
  id: string;
  parent: string;
  type: string;
  owner: User;
  body: string;
  date: number;
  image?: CubeImage;
}
