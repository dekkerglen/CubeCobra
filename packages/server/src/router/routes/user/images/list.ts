import {
  hostedImageToClient,
  MAX_BYTES_PER_USER,
  MAX_IMAGES_PER_USER,
} from '@utils/hostedImagesUtil';
import { hostedImageDao } from 'dynamo/daos';
import { csrfProtection, ensureAuthJson } from 'router/middleware';
import cloudwatch from 'serverutils/cloudwatch';

import { Request, Response } from '../../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    let lastKey: Record<string, any> | undefined;
    if (typeof req.query.lastKey === 'string' && req.query.lastKey) {
      try {
        const parsed = JSON.parse(req.query.lastKey);
        // Only accept a shape that looks like a real GSI1 LastEvaluatedKey; anything else would
        // trigger a DynamoDB ValidationException and surface as a 500.
        if (parsed && typeof parsed === 'object' && typeof parsed.GSI1PK === 'string') {
          lastKey = parsed;
        }
      } catch {
        lastKey = undefined;
      }
    }

    const result = await hostedImageDao.queryByOwner(user.id, lastKey);
    const usage = await hostedImageDao.getUsageForOwner(user.id);

    return res.status(200).json({
      success: 'true',
      images: result.items.map(hostedImageToClient),
      lastKey: result.lastKey,
      usage,
      limits: { maxImages: MAX_IMAGES_PER_USER, maxBytes: MAX_BYTES_PER_USER },
    });
  } catch (err) {
    cloudwatch.error('Hosted image list failed', (err as Error).message);
    return res.status(500).json({ success: 'false', message: 'Could not load your images.' });
  }
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [csrfProtection, ensureAuthJson, handler],
  },
];
