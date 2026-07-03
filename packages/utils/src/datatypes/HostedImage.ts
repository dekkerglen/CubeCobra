import { BaseObject } from './BaseObject';

// A user-uploaded image hosted by CubeCobra in R2 (or a local folder in dev) and
// served through the CDN. Only available to Lotus Cobra Patreon members and Admins.
export interface UnhydratedHostedImage extends BaseObject {
  id: string;
  owner: string; // user id
  // R2 object key, e.g. userimages/{owner}/{id}.webp
  key: string;
  // Stored as a relative path (e.g. /userimages/{owner}/{id}.webp). cdnUrl() is
  // applied on read so the public URL resolves to the CDN in prod / same-origin in dev.
  url: string;
  // Optional user-facing label.
  name?: string;
  // Stored (post-processing) size in bytes, used for per-user quota accounting.
  bytes: number;
  width?: number;
  height?: number;
  // Where the image was originally uploaded from, for display grouping. Optional.
  usage?: HostedImageUsage;
}

export type HostedImageUsage = 'general' | 'profile' | 'cube';

// Hydrated form. Identical shape, but `url` has cdnUrl() applied so it is directly usable.
export type HostedImage = UnhydratedHostedImage;

export default HostedImage;
