import Cube from 'datatypes/Cube';

export default interface User {
  id: string;
  username: string;
  usernameLower?: string;
  cubes?: Cube[];
  about?: string;
  hideTagColors?: boolean;
  followedCubes?: string[];
  followedUsers?: string[];
  following?: string[];
  imageName?: string;
  roles?: string[];
  theme?: string;
  hideFeatured?: boolean;
  patron?: string;
}
