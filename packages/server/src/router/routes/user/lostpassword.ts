import type { Request as ExpressRequest } from 'express';
import { passwordResetDao, userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { formLimiter, ipKey } from 'serverutils/rateLimiters';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

// The same answer whether or not the address has an account, so this form can't be used to
// find out who is registered.
export const LOST_PASSWORD_SENT =
  "If an account exists for that email address, we've sent it a link to reset your password.";

// Requests about one address from one client: caps how often a mailbox can be sent our emails.
export const emailRequestKey = (req: ExpressRequest): string =>
  `${ipKey(req)}:${String(req.body?.email ?? '').toLowerCase()}`;

const HOUR_MS = 60 * 60 * 1000;
const addressLimiter = formLimiter(HOUR_MS, 3, '/user/lostpassword', emailRequestKey);
const ipLimiter = formLimiter(HOUR_MS, 10, '/user/lostpassword');

export const getHandler = (req: Request, res: Response) => {
  return render(req, res, 'LostPasswordPage');
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      return render(req, res, 'LostPasswordPage');
    }
    const recoveryEmail = req.body.email.toLowerCase();

    const userByEmail = await userDao.getByEmail(recoveryEmail);
    const user = userByEmail ? await userDao.getByIdWithSensitiveData(userByEmail.id) : undefined;

    if (user) {
      const id = await passwordResetDao.putAndReturnId({
        owner: user.id,
        date: new Date().valueOf(),
        // Ties the link to the account's current credentials: once the password or email
        // changes, every link issued before it stops working.
        sessionVersion: user.sessionVersion ?? 0,
      });

      // Not awaited: the time the send takes would otherwise reveal that the account exists.
      sendEmail(user.email, 'Password Reset', 'password_reset', { id }).catch((err: Error) => {
        req.logger.error(`Failed to send password reset email: ${err.message}`, err.stack);
      });
    }

    req.flash('success', LOST_PASSWORD_SENT);
    return redirect(req, res, '/user/lostpassword');
  } catch (err) {
    return handleRouteError(req, res, err, `/user/lostpassword`);
  }
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [csrfProtection, getHandler],
  },
  {
    path: '/',
    method: 'post',
    handler: [
      ipLimiter,
      addressLimiter,
      csrfProtection,
      body('email', 'email is required').isEmail(),
      flashValidationErrors,
      postHandler,
    ],
  },
];
