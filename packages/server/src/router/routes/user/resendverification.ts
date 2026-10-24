import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { newAccountToken } from 'serverutils/passwordPolicy';
import { formLimiter } from 'serverutils/rateLimiters';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';
import { emailRequestKey } from './lostpassword';

// The same answer for an unknown address, a verified account and an unverified one, so this
// form can't be used to find out who is registered.
export const VERIFICATION_SENT =
  "If an account for that email address still needs verifying, we've sent it a new verification link.";

const HOUR_MS = 60 * 60 * 1000;
const addressLimiter = formLimiter(HOUR_MS, 3, '/user/login', emailRequestKey);
const ipLimiter = formLimiter(HOUR_MS, 10, '/user/login');

export const postHandler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      req.flash('danger', 'Please provide a valid email address.');
      return redirect(req, res, '/user/login');
    }

    const email = req.body.email.toLowerCase();

    // The verification token is sensitive data, so it's only on the full record.
    const found = await userDao.getByEmail(email);
    const user = found ? await userDao.getByIdWithSensitiveData(found.id) : undefined;

    if (user && user.emailVerified === false) {
      if (!user.token) {
        user.token = newAccountToken();
        await userDao.update(user);
      }

      // Not awaited: the time the send takes would otherwise reveal that the account exists.
      sendEmail(email, 'Please verify your Cube Cobra account', 'confirm_email', {
        id: user.id,
        token: user.token,
      }).catch((err: Error) => {
        req.logger.error(`Failed to send verification email: ${err.message}`, err.stack);
      });
    }

    req.flash('success', VERIFICATION_SENT);
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/user/login');
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [
      ipLimiter,
      addressLimiter,
      csrfProtection,
      body('email', 'Email is required').notEmpty(),
      body('email', 'Email is not valid').isEmail(),
      flashValidationErrors,
      postHandler,
    ],
  },
];
