import {
  ACCEPTED_MIME_TYPES,
  hostedImageToClient,
  MAX_BYTES_PER_USER,
  MAX_IMAGES_PER_USER,
  MAX_UPLOAD_BYTES,
} from '@utils/hostedImagesUtil';
import { hostedImageDao } from 'dynamo/daos';
import { UploadedFile } from 'express-fileupload';
import { csrfProtection, ensureAuthJson, ensureImageHosting } from 'router/middleware';
import cloudwatch from 'serverutils/cloudwatch';
import { buildImageKey, processImage, storeImage } from 'serverutils/hostedImageStorage';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../../types/express';

const ALLOWED_USAGE = ['general', 'profile', 'cube'] as const;

export const handler = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const uploaded = (req.files as Record<string, UploadedFile | UploadedFile[]> | undefined)?.image;
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    if (!file) {
      return res.status(400).json({ success: 'false', message: 'No image was uploaded.' });
    }

    if (file.truncated || file.size > MAX_UPLOAD_BYTES) {
      return res.status(400).json({
        success: 'false',
        message: `Image is too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      });
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        success: 'false',
        message: 'Unsupported image type. Allowed: JPG, PNG, WebP, GIF.',
      });
    }

    // Enforce per-user quota before doing expensive work.
    const usage = await hostedImageDao.getUsageForOwner(user.id);
    if (usage.count >= MAX_IMAGES_PER_USER) {
      return res.status(400).json({
        success: 'false',
        message: `You have reached the maximum of ${MAX_IMAGES_PER_USER} hosted images.`,
      });
    }

    let processed;
    try {
      processed = await processImage(file.data);
    } catch {
      return res.status(400).json({ success: 'false', message: 'That file could not be read as an image.' });
    }

    if (usage.bytes + processed.bytes > MAX_BYTES_PER_USER) {
      return res.status(400).json({
        success: 'false',
        message: `This upload would exceed your ${Math.round(MAX_BYTES_PER_USER / (1024 * 1024))}MB storage limit.`,
      });
    }

    const requestedUsage =
      typeof req.body?.usage === 'string' && (ALLOWED_USAGE as readonly string[]).includes(req.body.usage)
        ? (req.body.usage as (typeof ALLOWED_USAGE)[number])
        : 'general';

    const name = typeof req.body?.name === 'string' ? req.body.name.slice(0, 120) : file.name?.slice(0, 120);

    const imageId = uuidv4();
    const key = buildImageKey(user.id, imageId);
    const url = await storeImage(key, processed.body);

    const record = await hostedImageDao.createImage({
      id: imageId,
      owner: user.id,
      key,
      url,
      name,
      bytes: processed.bytes,
      width: processed.width,
      height: processed.height,
      usage: requestedUsage,
    });

    return res.status(200).json({ success: 'true', image: hostedImageToClient(record) });
  } catch (err) {
    cloudwatch.error('Hosted image upload failed', (err as Error).message, (err as Error).stack);
    return res.status(500).json({ success: 'false', message: 'Something went wrong uploading the image.' });
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuthJson, ensureImageHosting, handler],
  },
];
