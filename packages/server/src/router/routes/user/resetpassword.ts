import bcrypt from 'bcryptjs';
import User from 'dynamo/models/user';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.validated) {
    return redirect(req, res, '/user/account');
  }

  if (!req.user) {
    req.flash('danger', 'User not found');
    return redirect(req, res, '/user/account?nav=password');
  }

  const user = await User.getByIdWithSensitiveData(req.user.id);

  if (!user) {
    req.flash('danger', 'User not found');
    return redirect(req, res, '/user/account?nav=password');
  }

  return bcrypt.compare(req.body.password, user.passwordHash, (_err2, isMatch) => {
    if (!isMatch) {
      req.flash('danger', 'Password is incorrect');
      return redirect(req, res, '/user/account?nav=password');
    }
    if (req.body.password2 !== req.body.password3) {
      req.flash('danger', "New passwords don't match");
      return redirect(req, res, '/user/account?nav=password');
    }
    return bcrypt.genSalt(10, (_err3, salt) => {
      bcrypt.hash(req.body.password2, salt, async (err4, hash) => {
        if (err4) {
          return req.logger.error(err4.message, err4.stack);
        }
        if (user) {
          user.passwordHash = hash;
          await User.update(user as any);
        }
        req.flash('success', 'Password updated successfully');
        return redirect(req, res, '/user/account?nav=password');
      });
    });
  });
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
