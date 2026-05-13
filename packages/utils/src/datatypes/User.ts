import { PrintingPreference } from './Card';
import Cube from './Cube';
import Image from './Image';
import Notification from './Notification';

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
  /** Denormalized counts. Source of truth lives in relationship hash rows. */
  followerCount?: number; // users following this user
  followingCount?: number; // users this user follows
  likedCubesCount?: number; // cubes this user likes
  /** @deprecated retained on stored rows for the one-time migration to user-follow hash rows. */
  following?: string[];
  /** @deprecated retained on stored rows for the one-time migration to user-follow hash rows. */
  followedUsers?: string[];
  /** @deprecated retained on stored rows for the one-time migration to CUBE_LIKE hash rows. */
  followedCubes?: string[];
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
  useTextOverIcons?: boolean;
  disableFollowAlerts?: boolean;
}

export interface UserWithSensitiveInformation extends UnhydratedUser {
  passwordHash: string;
  email: string;
}

export default interface User extends Omit<UnhydratedUser, 'cubes'> {
  cubes?: Cube[];
  collaboratingCubes?: Cube[];
  image?: Image;
  notifications?: Notification[];
}
