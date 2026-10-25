import CubeType, { CUBE_CATEGORIES, CUBE_PREFIXES } from '@utils/datatypes/Cube';
import { DEFAULT_BANNER_THEME, normalizeBannerTheme } from '@utils/bannerTheme';
import { cubeDao, hostedImageDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { getCubeId, isCubeViewable } from 'serverutils/cubefn';
import { hasProfanity } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

export const editOverviewHandler = async (req: Request, res: Response) => {
  try {
    const updatedCube: CubeType = req.body.cube;

    const cube = await cubeDao.getById(updatedCube.id);
    const { user } = req;

    if (!cube || !isCubeViewable(cube, user)) {
      res.status(404).json({ error: 'Cube not found' });
      return;
    }

    if (cube.owner.id !== user?.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // if this cube has no cards, we deny them from making any changes
    // this is a spam prevention measure
    if (cube.cardCount === 0) {
      res
        .status(400)
        .json({ error: 'Cannot update the cube overview for an empty cube. Please add cards to the cube first.' });
      return;
    }

    if (hasProfanity(updatedCube.name)) {
      res.status(400).json({
        error:
          'Could not update cube, the name contains a banned word. If you feel this was a mistake, please contact us.',
      });
      return;
    }

    if (updatedCube.shortId !== cube.shortId) {
      if (hasProfanity(updatedCube.shortId)) {
        res.status(400).json({
          error:
            'Could not update cube, the short id contains a banned word. If you feel this was a mistake, please contact us.',
        });
        return;
      }

      // Check if shortId is already taken by another cube
      const existingCube = await cubeDao.getById(updatedCube.shortId);

      if (existingCube && existingCube.id !== cube.id) {
        res.status(400).json({ error: 'Could not update cube, the short id is already taken.' });
        return;
      }

      cube.shortId = updatedCube.shortId;
    }

    cube.name = updatedCube.name;
    cube.imageName = updatedCube.imageName;

    // Custom uploaded cube image (Lotus Cobra perk). An empty value clears it back to card art.
    if (typeof updatedCube.imgHostedImageId !== 'undefined') {
      if (updatedCube.imgHostedImageId) {
        const hostedImage = await hostedImageDao.getById(updatedCube.imgHostedImageId);
        if (hostedImage && hostedImage.owner === user?.id) {
          cube.imgHostedImageId = hostedImage.id;
          cube.imgHostedImageUrl = hostedImage.url;
        }
      } else {
        cube.imgHostedImageId = undefined;
        cube.imgHostedImageUrl = undefined;
      }
    }

    if (updatedCube.brief !== undefined) {
      cube.brief = updatedCube.brief;
    }

    // Hero banner theme. This endpoint mixes two conventions — `brief` is preserved when
    // absent, `categoryOverride` is cleared when null — and the banner theme follows `brief`:
    // several forms post a partial field list, and an absent field must never silently wipe a
    // theme the owner chose elsewhere. Choosing the default sends an explicit empty value.
    //
    // Read as `unknown`: `updatedCube` is request body cast to CubeType, so its declared
    // literal-union type is a claim about well-behaved clients, not about the wire.
    const submittedBannerTheme: unknown = updatedCube.bannerTheme;
    if (submittedBannerTheme !== undefined) {
      if (submittedBannerTheme === '') {
        cube.bannerTheme = undefined;
      } else {
        const bannerTheme = normalizeBannerTheme(submittedBannerTheme);

        if (!bannerTheme) {
          res.status(400).json({ error: 'Not a valid banner theme.' });
          return;
        }

        // The default is stored as absence, so a client that posts the default key by name
        // lands in the same state as one that posts an empty value. Without this there are
        // two indistinguishable stored states and the public JSON reports both.
        cube.bannerTheme = bannerTheme === DEFAULT_BANNER_THEME ? undefined : bannerTheme;
      }
    }

    cube.date = Date.now().valueOf();

    // cube category override
    if (updatedCube.categoryOverride !== null) {
      const categories = ['', ...CUBE_CATEGORIES];

      if (updatedCube.categoryOverride && !categories.includes(updatedCube.categoryOverride)) {
        res.status(400).json({ error: 'Not a valid category override.' });
        return;
      }

      cube.categoryOverride = updatedCube.categoryOverride;
    } else {
      cube.categoryOverride = undefined;
    }

    if (updatedCube.categoryPrefixes !== null) {
      for (let i = 0; i < (updatedCube.categoryPrefixes || []).length; i += 1) {
        if (!CUBE_PREFIXES.includes(updatedCube.categoryPrefixes[i])) {
          res.status(400).json({ error: 'Not a valid category prefix.' });
          return;
        }
      }
      cube.categoryPrefixes = updatedCube.categoryPrefixes;
    } else {
      cube.categoryPrefixes = [];
    }

    await cubeDao.update(cube);

    const redirect = `/cube/settings/${getCubeId(cube)}?view=overview`;

    res.status(200).json({ success: 'Cube updated successfully', redirect });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    res.status(500).json({ error: 'Error updating cube' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [ensureAuth, csrfProtection, editOverviewHandler],
  },
];
