// Shared helpers + constants for the hosted images feature. Kept in utils so both
// the server (enforcement) and the client (UI gating) use the same rules.
import { cdnUrl } from './cdnUrl';
import HostedImage from './datatypes/HostedImage';
import Image from './datatypes/Image';
import Patron, { PatronLevels, PatronStatuses } from './datatypes/Patron';
import { UserRoles } from './datatypes/User';

// Image hosting (and arbitrary profile/cube image uploads) is a Lotus Cobra perk.
export const IMAGE_HOSTING_TIER = PatronLevels['Lotus Cobra'];

// Per-user soft quota.
export const MAX_IMAGES_PER_USER = 1000;
export const MAX_BYTES_PER_USER = 1024 * 1024 * 1024; // 1024 MB (1 GB)

// Upload/processing constraints.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB input cap
export const MAX_IMAGE_DIMENSION = 1600; // px, longest edge after resize
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// R2 key prefix / served path prefix for hosted user images.
export const HOSTED_IMAGE_PREFIX = 'userimages';

// True if the user may upload/host images: an active Lotus Cobra patron, or an Admin.
export const canUseImageHosting = (
  patron: Patron | undefined | null,
  roles: UserRoles[] | undefined,
): boolean => {
  if (roles && roles.includes(UserRoles.ADMIN)) {
    return true;
  }
  return (
    patron !== undefined &&
    patron !== null &&
    patron.status === PatronStatuses.ACTIVE &&
    patron.level >= IMAGE_HOSTING_TIER
  );
};

// Serializes a stored HostedImage for the client, resolving its relative `url` to a full CDN URL.
export const hostedImageToClient = (image: HostedImage): HostedImage => ({
  ...image,
  url: cdnUrl(image.url),
});

export const HOSTED_IMAGE_LABEL = 'Custom Image';

// Builds the synthetic Image object for a hosted image so cube/profile custom images share one
// shape. `uri` must already be resolved (cdnUrl applied) — server hydration passes cdnUrl(relative),
// client callers pass the already-resolved url from hostedImageToClient.
export const hostedImageToImageData = (uri: string, id?: string): Image => ({
  uri,
  artist: '',
  id: id || 'hosted',
  imageName: HOSTED_IMAGE_LABEL,
});

// Client-friendly variant: the browser only knows the numeric level + status, not a full
// Patron record. Mirrors canUseImageHosting for the reactProps.user fields.
export const canUseImageHostingClient = (
  patronLevel: number | undefined,
  patronStatus: string | undefined,
  roles: UserRoles[] | undefined,
): boolean => {
  if (roles && roles.includes(UserRoles.ADMIN)) {
    return true;
  }
  return (
    patronLevel !== undefined &&
    patronStatus === PatronStatuses.ACTIVE &&
    patronLevel >= IMAGE_HOSTING_TIER
  );
};
