import { PatronStatuses } from '@utils/datatypes/Patron';
import { packageDao, patronDao, userDao } from 'dynamo/daos';
import { getCollaborationsPage } from 'serverutils/collaborations';
import { handleRouteError, redirect, render } from 'serverutils/render';

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

    const { cubes, nextOffset, hasMore } = await getCollaborationsPage(user.id, req.user);

    const patron = await patronDao.getById(user.id);
    const patronLevel = patron && patron.status === PatronStatuses.ACTIVE ? patron.level : undefined;

    return render(
      req,
      res,
      'UserCollaborationsPage',
      {
        owner: user,
        cubes,
        nextOffset,
        hasMore,
        followersCount: user.followerCount ?? 0,
        followingCount: user.followingCount ?? 0,
        following: !!req.user && (await userDao.getFollow(req.user.id, user.id)),
        patronLevel,
        likedCubesCount: user.likedCubesCount ?? 0,
        likedPackagesCount: await packageDao.countByVoter(user.id),
      },
      { title: `${user.username}'s Collaborations` },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [handler],
  },
];
