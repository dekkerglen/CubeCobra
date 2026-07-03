import { hostedImageDao, userDao } from 'dynamo/daos';
import { csrfProtection, ensureAuthJson } from 'router/middleware';
import cloudwatch from 'serverutils/cloudwatch';
import { deleteStoredImage } from 'serverutils/hostedImageStorage';
import { isAdmin } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

// If the owner is using this image as their avatar, clear the reference so their profile falls
// back to card art instead of rendering a broken 404 image everywhere they appear.
const clearProfileReference = async (ownerId: string, imageId: string): Promise<void> => {
  const owner = await userDao.getByIdWithSensitiveData(ownerId);
  if (owner && owner.profileHostedImageId === imageId) {
    owner.profileHostedImageId = undefined;
    owner.profileImageUrl = undefined;
    await userDao.update(owner as any);
  }
};

export const handler = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: 'false', message: 'Missing image id.' });
    }

    const image = await hostedImageDao.getById(id);
    if (!image) {
      // Already gone — treat as success so the UI can drop it.
      return res.status(200).json({ success: 'true' });
    }

    if (image.owner !== user.id && !isAdmin(user)) {
      return res.status(403).json({ success: 'false', message: 'You do not own this image.' });
    }

    // Delete the record first: an orphaned DynamoDB record renders as a broken image on reload,
    // whereas orphaned storage bytes are merely unreferenced. Clear the owner's avatar reference
    // in the same pass, then remove the bytes best-effort.
    await clearProfileReference(image.owner, image.id);
    await hostedImageDao.delete(image);
    try {
      await deleteStoredImage(image.key);
    } catch (storageErr) {
      cloudwatch.error('Hosted image bytes delete failed (record already removed)', (storageErr as Error).message);
    }

    return res.status(200).json({ success: 'true' });
  } catch (err) {
    cloudwatch.error('Hosted image delete failed', (err as Error).message);
    return res.status(500).json({ success: 'false', message: 'Could not delete the image.' });
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuthJson, handler],
  },
];
