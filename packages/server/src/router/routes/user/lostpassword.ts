import PasswordReset from 'dynamo/models/passwordReset';
import User from 'dynamo/models/user';
import { body } from 'express-validator';
import sendEmail from 'serverutils/email';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { csrfProtection, flashValidationErrors } from 'src/router/middleware';

import { Request, Response } from '../../../types/express';

export const getHandler = (req: Request, res: Response) => {
  return render(req, res, 'LostPasswordPage');
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      return render(req, res, 'LostPasswordPage');
    }
    const recoveryEmail = req.body.email.toLowerCase();

    const userByEmail = await User.getByEmail(recoveryEmail);

    if (!userByEmail) {
      req.flash('danger', 'No user with that email found.');
      return render(req, res, 'LostPasswordPage');
    }

    const user = await User.getByIdWithSensitiveData(userByEmail.id);

    if (!user) {
      req.flash('danger', 'User not found.');
      return render(req, res, 'LostPasswordPage');
    }

    const passwordReset = {
      owner: user.id,
      date: new Date().valueOf(),
    };

    const id = await PasswordReset.put(passwordReset);

    await sendEmail(user.email, 'Password Reset', 'password_reset', {
      id,
    });

    req.flash('success', `Password recovery email sent to ${recoveryEmail}`);
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
    handler: [csrfProtection, body('email', 'email is required').isEmail(), flashValidationErrors, postHandler],
  },
];
