import { PrintingPreference } from './Card';
import Cube from './Cube';
import Image from './Image';
import { Notification } from './Notification';

export enum GridTightnessPreference {
  TIGHT = 'tight',
  LOOSE = 'loose',
}
export const DefaultGridTightnessPreference = GridTightnessPreference.LOOSE;

export enum YourCubesSortOrder {
  ALPHA = 'alphabetical',
  LASTUPDATED = 'lastUpdated',
}
export const DefaultYourCubesSortOrder = YourCubesSortOrder.LASTUPDATED;

export enum UserRoles {
  ADMIN = 'Admin',
  CONTENT_CREATOR = 'ContentCreator',
  PATRON = 'Patron',
  BANNED = 'Banned',
}
export interface UnhydratedUser {
  id: string;
  username: string;
  usernameLower?: string;
  cubes?: string[];
  about?: string;
  hideTagColors?: boolean;
  followedCubes?: string[];
  followedUsers?: string[]; //Who this user is following
  following?: string[]; //Who is following this user
  imageName?: string;
  roles?: UserRoles[];
  theme?: string;
  email?: string;
  hideFeatured?: boolean;
  patron?: string;
  defaultPrinting?: PrintingPreference;
  gridTightness?: GridTightnessPreference;
  /* If true the "create blog post" action will be enabled when editing a cube.
   * Cube's local storage setting takes precedence
   */
  autoBlog?: boolean;
  consentToHashedEmail?: boolean;
  token?: string;
  emailVerified?: boolean;
  yourCubesSortOrder?: YourCubesSortOrder;
  disableAnimations?: boolean;
}

export interface UserWithSensitiveInformation extends UnhydratedUser {
  passwordHash: string;
  email: string;
}

export default interface User extends Omit<UnhydratedUser, 'cubes'> {
  cubes?: Cube[];
  image?: Image;
  notifications?: Notification[];
}
