import bcrypt from 'bcryptjs';
import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import { formLimiter } from 'serverutils/rateLimiters';
import { userOrIpKey } from 'serverutils/rateLimitKeys';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const PASSWORD_PAGE = '/user/account?nav=password';

const changePasswordLimiter = formLimiter(15 * 60 * 1000, 10, PASSWORD_PAGE, userOrIpKey);

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      return redirect(req, res, PASSWORD_PAGE);
    }

    if (!req.user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, PASSWORD_PAGE);
    }

    const user = await userDao.getByIdWithSensitiveData(req.user.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, PASSWORD_PAGE);
    }

    const isMatch = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isMatch) {
      req.flash('danger', 'Password is incorrect');
      return redirect(req, res, PASSWORD_PAGE);
    }

    if (req.body.password2 !== req.body.password3) {
      req.flash('danger', "New passwords don't match");
      return redirect(req, res, '/user/account?nav=password');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(req.body.password2, salt);
    // Changing the password is the advice for an email change you didn't ask for, so it also
    // cancels any change still waiting on confirmation.
    user.pendingEmail = '';
    user.pendingEmailToken = '';
    user.pendingEmailExpires = 0;
    await userDao.update(user as any);

    req.flash('success', 'Password updated successfully');
    return redirect(req, res, PASSWORD_PAGE);
  } catch (err) {
    return handleRouteError(req, res, err, PASSWORD_PAGE);
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [
      changePasswordLimiter,
      csrfProtection,
      ensureAuth,
      body('password', 'Password must be between 8 and 24 characters.').isLength({
        min: 8,
        max: 24,
      }),
      flashValidationErrors,
      handler,
    ],
  },
];
