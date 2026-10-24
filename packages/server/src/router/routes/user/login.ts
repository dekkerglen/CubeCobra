import passport from 'passport';
import { redirect, render } from 'serverutils/render';
import { getSafeReferrer } from 'serverutils/util';

import { LOGIN_FAILED_MESSAGE } from '../../../config/passport';
import { NextFunction, Request, Response } from '../../../types/express';

const getLoginRedirect = (req: Request) => {
  const redirectRoute = getSafeReferrer(req) || '/';

  //Landing is the public default page, dashboard is the logged in one
  if (redirectRoute === '/landing' || redirectRoute === '/user/login') {
    return '/dashboard';
  } else {
    return redirectRoute;
  }
};

export const getHandler = (req: Request, res: Response) => {
  return render(req, res, 'LoginPage');
};

export const postHandler = (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || username.length === 0 || typeof password !== 'string' || password.length === 0) {
    req.flash('danger', 'Please enter your username or email address and your password.');
    return redirect(req, res, '/user/login');
  }

  const destination = getLoginRedirect(req);

  // The local strategy (config/passport) resolves the username or email, checks the password,
  // and only then reports a ban or an unverified email, so a failed guess always gets the same
  // generic message.
  return passport.authenticate('local', (err: unknown, user: Express.User | false, info?: { message?: string }) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('danger', info?.message || LOGIN_FAILED_MESSAGE);
      return redirect(req, res, '/user/login');
    }
    return req.login(user, (loginErr: unknown) => {
      if (loginErr) {
        return next(loginErr);
      }
      return redirect(req, res, destination);
    });
  })(req, res, next);
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [getHandler],
  },
  {
    path: '/',
    method: 'post',
    handler: [postHandler],
  },
];
