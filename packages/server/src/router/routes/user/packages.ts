import { PatronStatuses } from '@utils/datatypes/Patron';
import { packageDao, patronDao, userDao } from 'dynamo/daos';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const { userid } = req.params;

    if (!userid) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await userDao.getById(userid);
    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const result = await packageDao.queryByOwner(userid, 'date', false, undefined, 36);

    const patron = await patronDao.getById(user.id);
    const patronLevel = patron && patron.status === PatronStatuses.ACTIVE ? patron.level : undefined;

    const likedCubesCount = user.likedCubesCount ?? 0;
    const likedPackagesCount = await packageDao.countByVoter(user.id);

    return render(
      req,
      res,
      'UserPackagesPage',
      {
        owner: user,
        followersCount: user.followerCount ?? 0,
        followingCount: user.followingCount ?? 0,
        following: !!req.user && (await userDao.getFollow(req.user.id, user.id)),
        packages: result.items || [],
        lastKey: result.lastKey,
        patronLevel,
        likedCubesCount,
        likedPackagesCount,
      },
      { title: `${user.username}'s Packages` },
    );
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
