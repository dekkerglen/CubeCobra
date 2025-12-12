import { draftDao } from 'dynamo/daos';
import User from 'dynamo/models/user';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const { userid } = req.params;

    if (!userid) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await User.getById(userid);
    const decks = await draftDao.queryByOwner(userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    return render(req, res, 'UserDecksPage', {
      owner: user,
      followersCount: (user.following || []).length,
      following: req.user && (req.user.followedUsers || []).some((id) => id === user.id),
      decks: decks.items,
      lastKey: decks.lastKey,
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
