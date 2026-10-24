import { PatronStatuses } from '@utils/datatypes/Patron';
import { cubeDao, draftDao, packageDao, patronDao, userDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

/**
 * Drops drafts whose cube the viewer can't see (a private cube they don't own or collaborate
 * on, or a deleted one), so a profile's deck list doesn't hand out private cube and deck ids.
 */
export const filterViewableDrafts = async <D extends { cube: string }>(
  drafts: D[],
  viewer: Request['user'],
): Promise<D[]> => {
  const cubeIds = [...new Set(drafts.map((draft) => draft.cube).filter(Boolean))];
  const cubes = await cubeDao.batchGet(cubeIds);
  const viewable = new Set(cubes.filter((cube) => isCubeViewable(cube, viewer)).map((cube) => cube.id));
  return drafts.filter((draft) => viewable.has(draft.cube));
};

export const handler = async (req: Request, res: Response) => {
  try {
    const { userid } = req.params;

    if (!userid) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await userDao.getById(userid);
    // Use unhydrated query to avoid loading cards/seats from S3 for better performance
    const decks = await draftDao.queryByOwnerUnhydrated(userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const patron = await patronDao.getById(user.id);
    const patronLevel = patron && patron.status === PatronStatuses.ACTIVE ? patron.level : undefined;

    const likedCubesCount = user.likedCubesCount ?? 0;
    const likedPackagesCount = await packageDao.countByVoter(user.id);

    return render(req, res, 'UserDecksPage', {
      owner: user,
      followersCount: user.followerCount ?? 0,
      followingCount: user.followingCount ?? 0,
      following: !!req.user && (await userDao.getFollow(req.user.id, user.id)),
      decks: await filterViewableDrafts(decks.items, req.user),
      lastKey: decks.lastKey,
      patronLevel,
      likedCubesCount,
      likedPackagesCount,
    });
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:userid',
    method: 'get',
    handler: [handler],
  },
];
