import { userDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return redirect(req, res, '/user/login');
  }

  const emailUser = await userDao.getByEmail(req.body.email.toLowerCase());

  if (emailUser && emailUser.id === req.user.id) {
    req.flash('danger', 'This is already your email.');
    return redirect(req, res, '/user/account');
  }

  if (emailUser) {
    req.flash('danger', 'email already taken.');
    return redirect(req, res, '/user/account');
  }

  const user = await userDao.getById(req.user.id);

  if (!user) {
    req.flash('danger', 'User not found.');
    return redirect(req, res, '/user/account');
  }

  user.email = req.body.email;
  await userDao.update(user);

  req.flash('success', 'Your profile has been updated.');
  return redirect(req, res, '/user/account');
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
