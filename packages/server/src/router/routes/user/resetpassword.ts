import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import { comparePassword, hashPassword, newPasswordValidator } from 'serverutils/passwordPolicy';
import { formLimiter } from 'serverutils/rateLimiters';
import { userOrIpKey } from 'serverutils/rateLimitKeys';
import { handleRouteError, redirect } from 'serverutils/render';

import { renewSession } from '../../../config/passport';
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

    if (!(await comparePassword(req.body.password, user.passwordHash))) {
      req.flash('danger', 'Password is incorrect');
      return redirect(req, res, PASSWORD_PAGE);
    }

    user.passwordHash = await hashPassword(req.body.password2);
    // Signs out every other session (and retires outstanding reset links); this one is renewed below.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    // Changing the password is the advice for an email change you didn't ask for, so it also
    // cancels any change still waiting on confirmation.
    user.pendingEmail = '';
    user.pendingEmailToken = '';
    user.pendingEmailExpires = 0;
    await userDao.update(user as any);

    await renewSession(req, user.id, user.sessionVersion);

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
      // The current password is only compared against its hash, so it isn't held to the policy:
      // accounts with a password set under older rules must still be able to change it.
      body('password', 'Please enter your current password.').isString().notEmpty(),
      newPasswordValidator('password2'),
      body('password3', "New passwords don't match").custom(
        (value: unknown, { req }: any) => value === req.body.password2,
      ),
      flashValidationErrors,
      handler,
    ],
  },
];
