import { PrintingPreference } from './Card';
import Cube from './Cube';
import Image from './Image';
import { Notification } from './Notification';

export enum GridTightnessPreference {
  TIGHT = 'tight',
  LOOSE = 'loose',
}
export const DefaultGridTightnessPreference = GridTightnessPreference.LOOSE;

export default interface User {
  id: string;
  username: string;
  usernameLower?: string;
  cubes?: Cube[];
  about?: string;
  hideTagColors?: boolean;
  followedCubes?: string[];
  followedUsers?: string[]; //Who this user is following
  following?: string[]; //Who is following this user
  image?: Image;
  imageName?: string;
  roles?: string[];
  theme?: string;
  email?: string;
  hideFeatured?: boolean;
  patron?: string;
  notifications?: Notification[];
  defaultPrinting?: PrintingPreference;
  gridTightness?: GridTightnessPreference;
}
