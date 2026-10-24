import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { comparePassword, newAccountToken } from 'serverutils/passwordPolicy';
import { formLimiter } from 'serverutils/rateLimiters';
import { userOrIpKey } from 'serverutils/rateLimitKeys';
import { handleRouteError, redirect } from 'serverutils/render';
import { validateEmail } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const EMAIL_PAGE = '/user/account?nav=email';

// How long the confirmation link sent to the new address keeps working.
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

// Requires the password and sends mail to an address of the requester's choosing.
const updateEmailLimiter = formLimiter(60 * 60 * 1000, 5, EMAIL_PAGE, userOrIpKey);

// Nothing changes here: the new address is held as pending and only swapped in by
// /user/confirmemailchange once someone with access to that inbox clicks the link.
export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.validated || typeof req.body.email !== 'string') {
      return redirect(req, res, EMAIL_PAGE);
    }

    if (!req.user) {
      return redirect(req, res, '/user/login');
    }

    const user = await userDao.getByIdWithSensitiveData(req.user.id);

    if (!user) {
      req.flash('danger', 'User not found.');
      return redirect(req, res, EMAIL_PAGE);
    }

    // A session alone isn't enough to move the account to another address.
    if (!(await comparePassword(req.body.password, user.passwordHash))) {
      req.flash('danger', 'Password is incorrect.');
      return redirect(req, res, EMAIL_PAGE);
    }

    const email = req.body.email.toLowerCase();

    try {
      validateEmail(email);
    } catch (err) {
      req.flash('danger', (err as Error).message);
      return redirect(req, res, EMAIL_PAGE);
    }

    if (email === user.email?.toLowerCase()) {
      req.flash('danger', 'This is already your email.');
      return redirect(req, res, EMAIL_PAGE);
    }

    if (await userDao.getByEmail(email)) {
      req.flash('danger', 'That email address is already in use by another account.');
      return redirect(req, res, EMAIL_PAGE);
    }

    const token = newAccountToken();
    user.pendingEmail = email;
    user.pendingEmailToken = token;
    user.pendingEmailExpires = Date.now() + EMAIL_CHANGE_TTL_MS;
    await userDao.update(user as any);

    await sendEmail(email, 'Confirm your new Cube Cobra email address', 'confirm_email_change', {
      id: user.id,
      token,
      username: user.username,
    });

    if (user.email) {
      await sendEmail(user.email, 'Your Cube Cobra email address is being changed', 'email_change_notice', {
        username: user.username,
      });
    }

    req.flash(
      'success',
      `Almost done! We've sent a confirmation link to ${email}. Your email address will change once you open that link, which works for the next 24 hours.`,
    );
    return redirect(req, res, EMAIL_PAGE);
  } catch (err) {
    return handleRouteError(req, res, err, EMAIL_PAGE);
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [
      updateEmailLimiter,
      csrfProtection,
      ensureAuth,
      body('email', 'Please enter a valid email address.').isString().trim().isEmail().isLength({ max: 254 }),
      body('password', 'Please enter your current password.').isString().notEmpty(),
      flashValidationErrors,
      handler,
    ],
  },
];
