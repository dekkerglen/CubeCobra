import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import passport from 'passport';
import { formLimiter, ipKey } from 'serverutils/rateLimiters';
import { redirect, render } from 'serverutils/render';
import { getSafeReferrer } from 'serverutils/util';

import { LOGIN_FAILED_MESSAGE } from '../../../config/passport';
import { NextFunction, Request, Response } from '../../../types/express';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Guessing passwords for one account from one address.
export const loginAccountKey = (req: ExpressRequest): string =>
  `${ipKey(req)}:${String(req.body?.username ?? '').toLowerCase()}`;

// Only failed attempts count toward the limits: signing in successfully isn't guessing, and
// counting it locked out anyone who signs in often. postHandler flags the success itself, so a
// request from someone who is already signed in still counts when its guess fails.
export const loginLimiterOptions = {
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req: ExpressRequest, res: ExpressResponse) => res.locals.loginSucceeded === true,
};

const accountLimiter = formLimiter(LOGIN_WINDOW_MS, 10, '/user/login', loginAccountKey, loginLimiterOptions);
// A looser cap on one address spraying guesses across many accounts.
const ipLimiter = formLimiter(LOGIN_WINDOW_MS, 50, '/user/login', ipKey, loginLimiterOptions);

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
  return render(req, res, 'LoginPage', {}, { title: 'Log In' });
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
      res.locals.loginSucceeded = true;
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
    handler: [ipLimiter, accountLimiter, postHandler],
  },
];
