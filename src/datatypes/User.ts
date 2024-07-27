export default interface User {
  id: string;
  username: string;
  usernameLower: string;
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