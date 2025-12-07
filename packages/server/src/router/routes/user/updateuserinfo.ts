import User from 'dynamo/models/user';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import { handleRouteError, redirect } from 'serverutils/render';
import { hasProfanity } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

// For consistency between different forms, validate username through this function.
const usernameValid = [
  body('username', 'username is required').notEmpty(),
  body('username', 'username must be between 5 and 24 characters.').isLength({
    min: 5,
    max: 24,
  }),
  body('username', 'username must only contain alphanumeric characters.').matches(/^[0-9a-zA-Z]*$/, 'i'),
  body('username', 'username may not use profanity.').custom((value: string) => !hasProfanity(value)),
];

export const handler = async (req: Request, res: Response) => {
  try {
    const { user } = req;

    if (!user) {
      return redirect(req, res, '/user/login');
    }

    if (!req.validated) {
      return redirect(req, res, '/user/account');
    }

    if (req.body.username.toLowerCase() !== user.username.toLowerCase()) {
      const userByName = await User.getByUsername(req.body.username.toLowerCase());

      if (userByName) {
        req.flash('danger', 'username already taken.');
        return redirect(req, res, '/user/account');
      }
    }

    if (hasProfanity(req.body.username)) {
      req.flash('danger', 'username may not use profanity. If you believe this is in error, please contact us.');
      return redirect(req, res, '/user/account');
    }

    if (hasProfanity(req.body.body)) {
      req.flash('danger', 'About me may not use profanity. If you believe this is in error, please contact us.');
      return redirect(req, res, '/user/account');
    }

    user.username = req.body.username;
    user.usernameLower = req.body.username.toLowerCase();
    user.about = req.body.body;
    if (req.body.image) {
      user.imageName = req.body.image;
    }
    await User.update(user);

    req.flash('success', 'User information updated.');
    return redirect(req, res, '/user/account');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/user/account');
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, ...usernameValid, flashValidationErrors, handler],
  },
];
