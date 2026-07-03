// Storage pipeline for user-uploaded hosted images (Lotus Cobra perk).
//
// Processing: images are re-encoded to WebP via sharp, auto-oriented, metadata stripped, and
// capped at MAX_IMAGE_DIMENSION on the longest edge.
//
// Storage: in production the processed bytes go to the R2 bucket under the `userimages/` prefix
// and are served through the CDN (CDN_BASE_URL). When R2 is not configured (local dev) the bytes
// are written to packages/server/public/userimages/ and served same-origin by express.static.
import { HOSTED_IMAGE_PREFIX, MAX_IMAGE_DIMENSION } from '@utils/hostedImagesUtil';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

import { deleteObject, putObject, r2Configured } from './r2';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Local dev fallback directory (served by express.static(public)).
const LOCAL_PUBLIC_DIR = path.join(__dirname, '../../public');

export interface ProcessedImage {
  body: Buffer;
  width?: number;
  height?: number;
  bytes: number;
}

// Raster formats we actually accept, matched against sharp's content-sniffed format (NOT the
// client-declared Content-Type, which is trivially spoofable). Deliberately excludes 'svg' —
// rasterizing attacker SVG via librsvg can enable SSRF / local-file disclosure.
const ALLOWED_INPUT_FORMATS = ['jpeg', 'png', 'webp', 'gif'];

/**
 * Re-encodes an arbitrary image buffer to a normalized WebP, resized to fit within
 * MAX_IMAGE_DIMENSION. Throws if the input is not a decodable image of an accepted format.
 */
export const processImage = async (input: Buffer): Promise<ProcessedImage> => {
  // limitInputPixels caps decode work to guard against decompression-bomb inputs.
  const probe = await sharp(input, { limitInputPixels: 100_000_000 }).metadata();
  if (!probe.format || !ALLOWED_INPUT_FORMATS.includes(probe.format)) {
    throw new Error(`Unsupported image format: ${probe.format || 'unknown'}`);
  }

  const pipeline = sharp(input, { animated: true, limitInputPixels: 100_000_000 })
    .rotate() // apply EXIF orientation, then metadata is dropped on re-encode
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 });

  const body = await pipeline.toBuffer();
  const meta = await sharp(body).metadata();

  return {
    body,
    width: meta.width,
    height: meta.height,
    bytes: body.length,
  };
};

/**
 * Builds the storage key for a user's image.
 */
export const buildImageKey = (ownerId: string, imageId: string): string =>
  `${HOSTED_IMAGE_PREFIX}/${ownerId}/${imageId}.webp`;

/**
 * Stores processed image bytes at the given key. Returns the relative public URL path
 * (cdnUrl() must be applied by the caller before handing it to a browser).
 */
export const storeImage = async (key: string, body: Buffer): Promise<string> => {
  if (r2Configured()) {
    await putObject(key, body, 'image/webp', CACHE_CONTROL);
  } else {
    const filePath = path.join(LOCAL_PUBLIC_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }
  return `/${key}`;
};

/**
 * Deletes stored image bytes at the given key. Best-effort: a missing local file is ignored.
 */
export const deleteStoredImage = async (key: string): Promise<void> => {
  if (r2Configured()) {
    await deleteObject(key);
  } else {
    const filePath = path.join(LOCAL_PUBLIC_DIR, key);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
    }
  }
};
