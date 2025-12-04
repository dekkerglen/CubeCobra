import User from 'dynamo/models/user';
import passport from 'passport';
import { redirect, render } from 'serverutils/render';
import { getSafeReferrer } from 'serverutils/util';
import { Request, Response } from '../../../types/express';

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

export const postHandler = async (req: Request, res: Response) => {
  let user;

  if (!req.body.username || req.body.username.toLowerCase().length === 0) {
    req.flash('danger', 'Incorrect Username or email address.');
    return redirect(req, res, '/user/login');
  }

  if (req.body.username.includes('@')) {
    user = await User.getByEmail(req.body.username.toLowerCase());
  } else {
    user = await User.getByUsername(req.body.username.toLowerCase());
  }

  if (!user) {
    req.flash('danger', 'Incorrect Username or email address.');
    return redirect(req, res, '/user/login');
  }

  if ((user as any).emailVerified === false) {
    req.flash('danger', 'Your account is not verified. Please check your email for a verification link.');
    return redirect(req, res, '/user/login');
  }

  req.body.username = user.username;
  passport.authenticate('local', {
    successRedirect: getLoginRedirect(req),
    failureRedirect: '/user/login',
    failureFlash: 'Incorrect username or password.',
  })(req, res, () => {
    return redirect(req, res, '/');
  });
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
