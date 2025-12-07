import bcrypt from 'bcryptjs';
import PasswordReset from 'dynamo/models/passwordReset';
import User from 'dynamo/models/user';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors } from 'router/middleware';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

function checkPasswordsMatch(value: string, { req }: any) {
  if (value !== req.body.password2) {
    throw new Error('Password confirmation does not match password');
  }
  return true;
}

export const getHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid password reset link');
    return redirect(req, res, '/');
  }

  const document = await PasswordReset.getById(req.params.id);
  if (!document || Date.now().valueOf() > document.date + 6 * 60 * 60 * 1000) {
    req.flash('danger', 'Password recovery link expired');
    return redirect(req, res, '/');
  }
  return render(req, res, 'PasswordResetPage', { code: req.params.id });
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }
    const recoveryEmail = req.body.email.toLowerCase();
    const passwordreset = await PasswordReset.getById(req.body.code);

    if (!passwordreset) {
      req.flash('danger', 'Incorrect email and recovery code combination.');
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }
    const userByEmail = await User.getByEmail(recoveryEmail);

    if (!userByEmail) {
      req.flash('danger', 'No user with that email found! Are you sure you created an account?');
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }

    const user = await User.getByIdWithSensitiveData(userByEmail.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }

    if (req.body.password2 !== req.body.password) {
      req.flash('danger', "New passwords don't match");
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(req.body.password2, salt);
    await User.update(user as any);

    req.flash('success', 'Password updated successfully');
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err, `/user/login`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, getHandler],
  },
  {
    path: '/',
    method: 'post',
    handler: [
      csrfProtection,
      body('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max: 24 }),
      body('password', 'New passwords must match.').custom(checkPasswordsMatch),
      flashValidationErrors,
      postHandler,
    ],
  },
];
