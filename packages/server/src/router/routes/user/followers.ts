import { PatronStatuses } from '@utils/datatypes/Patron';
import { packageDao, patronDao, userDao } from 'dynamo/daos';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const PAGE_SIZE = 36;

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

    const followerPage = await userDao.queryFollowersOf(user.id, undefined, PAGE_SIZE);
    const followers = await userDao.batchGet(followerPage.userIds);
    const following = !!req.user && (await userDao.getFollow(req.user.id, user.id));

    const patron = await patronDao.getById(user.id);
    const patronLevel = patron && patron.status === PatronStatuses.ACTIVE ? patron.level : undefined;

    const likedCubesCount = user.likedCubesCount ?? 0;
    const likedPackagesCount = await packageDao.countByVoter(user.id);

    return render(
      req,
      res,
      'UserFollowersPage',
      {
        owner: user,
        followers,
        lastKey: followerPage.lastKey,
        followersCount: user.followerCount ?? 0,
        followingCount: user.followingCount ?? 0,
        following,
        patronLevel,
        likedCubesCount,
        likedPackagesCount,
      },
      { title: `${user.username}'s Followers` },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const getMoreFollowersHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lastKey = req.body?.lastKey;
    if (!id) {
      return res.status(400).send({ success: 'false', message: 'user id required' });
    }

    const user = await userDao.getById(id);
    if (!user) {
      return res.status(404).send({ success: 'false', message: 'User not found' });
    }

    const page = await userDao.queryFollowersOf(user.id, lastKey || undefined, PAGE_SIZE);
    const followers = await userDao.batchGet(page.userIds);

    return res.status(200).send({
      success: 'true',
      followers,
      lastKey: page.lastKey,
    });
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
  {
    path: '/getmore/:id',
    method: 'post',
    handler: [getMoreFollowersHandler],
  },
];
