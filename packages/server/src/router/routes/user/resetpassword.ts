import bcrypt from 'bcryptjs';
import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.validated) {
    return redirect(req, res, '/user/account');
  }

  if (!req.user) {
    req.flash('danger', 'User not found');
    return redirect(req, res, '/user/account?nav=password');
  }

  try {
    const user = await userDao.getByIdWithSensitiveData(req.user.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/user/account?nav=password');
    }

    const isMatch = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isMatch) {
      req.flash('danger', 'Password is incorrect');
      return redirect(req, res, '/user/account?nav=password');
    }

    if (req.body.password2 !== req.body.password3) {
      req.flash('danger', "New passwords don't match");
      return redirect(req, res, '/user/account?nav=password');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(req.body.password2, salt);
    await userDao.update(user as any);

    req.flash('success', 'Password updated successfully');
    return redirect(req, res, '/user/account?nav=password');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/user/account?nav=password');
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [
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
