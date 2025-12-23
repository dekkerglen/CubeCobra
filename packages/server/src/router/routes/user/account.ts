import { cubeDao, userDao } from 'dynamo/daos';
import { featuredQueueDao } from 'dynamo/daos';
import { patronDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return redirect(req, res, '/user/login');
  }

  // Fetch user with email to display on account page
  const userWithEmail = await userDao.getByIdWithSensitiveData(req.user.id);

  const patron = await patronDao.getById(req.user.id);

  const entireQueue = [];

  if (patron) {
    let lastKey;

    do {
      const result = await featuredQueueDao.querySortedByDate(lastKey);
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
      userEmail: userWithEmail?.email,
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
