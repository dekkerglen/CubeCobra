import bcrypt from 'bcryptjs';
import PasswordReset from 'dynamo/models/passwordReset';
import User from 'dynamo/models/user';
import { body } from 'express-validator';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { csrfProtection, flashValidationErrors } from 'src/router/middleware';
import { Request, Response } from '../../../types/express';

function checkPasswordsMatch(value: string, { req }: any) {
  if (value !== req.body.password2) {
    throw new Error('Password confirmation does not match password');
  }
  return true;
}

export const handler = async (req: Request, res: Response) => {
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
    path: '/',
    method: 'post',
    handler: [
      csrfProtection,
      body('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max: 24 }),
      body('password', 'New passwords must match.').custom(checkPasswordsMatch),
      flashValidationErrors,
      handler,
    ],
  },
];
