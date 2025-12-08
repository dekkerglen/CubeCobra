import { cubeDao } from 'dynamo/daos';
import { FeaturedQueue } from 'dynamo/models/featuredQueue';
import Patron from 'dynamo/models/patron';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return redirect(req, res, '/user/login');
  }

  const patron = await Patron.getById(req.user.id);

  const entireQueue = [];

  if (patron) {
    let lastKey;

    do {
      const result = await FeaturedQueue.querySortedByDate(lastKey);
      lastKey = result.lastKey;
      if (result.items) {
        entireQueue.push(...result.items);
      }
    } while (lastKey);
  }

  const i = entireQueue.findIndex((f) => f.owner === req.user?.id);
  let myFeatured;
  if (i !== -1 && entireQueue[i]) {
    const cube = await cubeDao.getById(entireQueue[i].cube);
    myFeatured = { cube, position: i + 1 };
  }

  return render(
    req,
    res,
    'UserAccountPage',
    {
      defaultNav: req.query.nav || 'profile',
      patreonRedirectUri: process.env.PATREON_REDIRECT || '',
      patreonClientId: process.env.PATREON_CLIENT_ID || '',
      patron,
      featured: myFeatured,
    },
    {
      title: 'Account',
    },
  );
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
