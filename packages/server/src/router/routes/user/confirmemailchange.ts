import { userDao } from 'dynamo/daos';
import { tokensMatch } from 'serverutils/passwordPolicy';
import { formLimiter } from 'serverutils/rateLimiters';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';
import { EMAIL_PAGE } from './updateemail';

// Tokens are 32 random bytes, so this mostly limits load.
const confirmLimiter = formLimiter(15 * 60 * 1000, 30, '/');

// Reached from the link emailed to the new address by /user/updateemail. The token is the
// proof of access to that inbox, so the link works whether or not this browser is signed in.
export const handler = async (req: Request, res: Response) => {
  try {
    const { id, token } = req.params;
    const user = id ? await userDao.getByIdWithSensitiveData(id) : undefined;
    const signedInAsOwner = !!req.user && req.user.id === id;

    if (
      !user ||
      !user.pendingEmail ||
      !user.pendingEmailExpires ||
      Date.now() > user.pendingEmailExpires ||
      !tokensMatch(user.pendingEmailToken, token)
    ) {
      req.flash('danger', 'This confirmation link is invalid or has expired. Please request the email change again.');
      return redirect(req, res, req.user ? EMAIL_PAGE : '/user/login');
    }

    const newEmail = user.pendingEmail;
    user.pendingEmail = '';
    user.pendingEmailToken = '';
    user.pendingEmailExpires = 0;

    // Someone may have registered or switched to the address since the change was requested.
    const existing = await userDao.getByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      await userDao.update(user as any);
      req.flash('danger', 'That email address is now used by another account, so your email was not changed.');
      return redirect(req, res, signedInAsOwner ? EMAIL_PAGE : '/user/login');
    }

    user.email = newEmail;
    user.emailVerified = true;
    user.token = '';
    await userDao.update(user as any);

    if (signedInAsOwner) {
      req.flash(
        'success',
        'Your email address has been updated. Any other devices signed in to your account were signed out.',
      );
      return redirect(req, res, EMAIL_PAGE);
    }

    req.flash('success', 'Your email address has been updated. Please log in again.');
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err, '/');
  }
};

export const routes = [
  {
    path: '/:id/:token',
    method: 'get',
    handler: [confirmLimiter, handler],
  },
];
