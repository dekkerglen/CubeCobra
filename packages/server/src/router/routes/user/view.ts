import { PatronStatuses } from '@utils/datatypes/Patron';
import { cubeDao, packageDao, patronDao, userDao } from 'dynamo/daos';
import { isCubeListed } from 'serverutils/cubefn';
import { getCubesSortValues, getPinnedCubesForOwner, handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await userDao.getByIdOrUsername(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const { sort, ascending } = getCubesSortValues(user);

    const [result, { pinnedCubes, pinnedIds }] = await Promise.all([
      cubeDao.queryByOwner(user.id, sort, ascending, undefined, 36),
      getPinnedCubesForOwner(user.id, req.user?.id),
    ]);

    // Hoist the owner's pinned cubes to the top. Subsequent pages (via
    // /user/getmorecubes) filter these out so they never duplicate.
    const visiblePinned = pinnedCubes.filter((cube) => isCubeListed(cube, req.user));
    const pageItems = result.items.filter((cube: any) => isCubeListed(cube, req.user) && !pinnedIds.has(cube.id));
    const cubes = [...visiblePinned, ...pageItems];

    const following = !!req.user && (await userDao.getFollow(req.user.id, user.id));

    const patron = await patronDao.getById(user.id);
    const patronLevel = patron && patron.status === PatronStatuses.ACTIVE ? patron.level : undefined;

    const likedCubesCount = user.likedCubesCount ?? 0;
    const likedPackagesCount = await packageDao.countByVoter(user.id);

    return render(req, res, 'UserCubePage', {
      owner: user,
      cubes,
      lastKey: result.lastKey,
      followersCount: user.followerCount ?? 0,
      followingCount: user.followingCount ?? 0,
      following,
      patronLevel,
      likedCubesCount,
      likedPackagesCount,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [handler],
  },
];
