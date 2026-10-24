import { PatronStatuses } from '@utils/datatypes/Patron';
import { cubeDao, packageDao, patronDao, userDao } from 'dynamo/daos';
import { csrfProtection } from 'router/middleware';
import { isCubeListed, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.userid) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const owner = await userDao.getByIdOrUsername(req.params.userid);

    if (!owner) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const likedIds = await cubeDao.queryCubesLikedBy(owner.id, undefined, 200);
    // Other visitors only see listed cubes; the liker also sees unlisted (or private) cubes they
    // can open themselves.
    const isOwnPage = !!req.user && req.user.id === owner.id;
    const followedCubes = (await cubeDao.batchGet(likedIds.cubeIds)).filter((cube: any) =>
      isOwnPage ? isCubeViewable(cube, req.user) : isCubeListed(cube, req.user),
    );

    const following = !!req.user && (await userDao.getFollow(req.user.id, owner.id));

    const patron = await patronDao.getById(owner.id);
    const patronLevel = patron && patron.status === PatronStatuses.ACTIVE ? patron.level : undefined;

    const likedCubesCount = owner.likedCubesCount ?? followedCubes.length;
    const likedPackagesCount = await packageDao.countByVoter(owner.id);

    return render(
      req,
      res,
      'LikedCubesPage',
      {
        owner,
        cubes: followedCubes,
        followersCount: owner.followerCount ?? 0,
        followingCount: owner.followingCount ?? 0,
        following,
        patronLevel,
        likedCubesCount,
        likedPackagesCount,
      },
      {
        title: `${owner.username}'s Liked Cubes`,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/');
  }
};

export const routes = [
  {
    path: '/:userid',
    method: 'get',
    handler: [csrfProtection, handler],
  },
];
