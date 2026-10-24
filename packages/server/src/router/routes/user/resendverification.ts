import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { formLimiter } from 'serverutils/rateLimiters';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';
import { emailRequestKey } from './lostpassword';

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

    if (!user) {
      // Don't reveal whether the email exists or not for security
      req.flash('success', 'If an unverified account exists with this email, a verification link has been sent.');
      return redirect(req, res, '/user/login');
    }

    // Check if already verified
    if ((user as any).emailVerified === true) {
      req.flash('info', 'This account is already verified. You can login.');
      return redirect(req, res, '/user/login');
    }

    // Send verification email
    await sendEmail(email, 'Please verify your Cube Cobra account', 'confirm_email', {
      id: user.id,
      token: (user as any).token,
    });

    req.flash('success', 'Verification email sent! Please check your email for a verification link.');
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
