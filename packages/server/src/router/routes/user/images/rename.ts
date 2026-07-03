import { hostedImageToClient } from '@utils/hostedImagesUtil';
import { hostedImageDao } from 'dynamo/daos';
import { csrfProtection, ensureAuthJson } from 'router/middleware';
import cloudwatch from 'serverutils/cloudwatch';
import { isAdmin } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id, name } = req.body;

    if (!id || typeof name !== 'string') {
      return res.status(400).json({ success: 'false', message: 'Missing image id or name.' });
    }

    const image = await hostedImageDao.getById(id);
    if (!image) {
      return res.status(404).json({ success: 'false', message: 'Image not found.' });
    }

    if (image.owner !== user.id && !isAdmin(user)) {
      return res.status(403).json({ success: 'false', message: 'You do not own this image.' });
    }

    image.name = name.slice(0, 120);
    image.dateLastUpdated = Date.now();
    await hostedImageDao.update(image);

    return res.status(200).json({ success: 'true', image: hostedImageToClient(image) });
  } catch (err) {
    cloudwatch.error('Hosted image rename failed', (err as Error).message);
    return res.status(500).json({ success: 'false', message: 'Could not rename the image.' });
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuthJson, handler],
  },
];
