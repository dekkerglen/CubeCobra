import User from 'dynamo/models/user';
import { redirect } from 'serverutils/render';
import { csrfProtection, ensureAuth } from 'src/router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return redirect(req, res, '/user/login');
  }

  const emailUser = await User.getByEmail(req.body.email.toLowerCase());

  if (emailUser && emailUser.id === req.user.id) {
    req.flash('danger', 'This is already your email.');
    return redirect(req, res, '/user/account');
  }

  if (emailUser) {
    req.flash('danger', 'email already taken.');
    return redirect(req, res, '/user/account');
  }

  const user = await User.getById(req.user.id);

  if (!user) {
    req.flash('danger', 'User not found.');
    return redirect(req, res, '/user/account');
  }

  user.email = req.body.email;
  await User.update(user);

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
