import { userDao } from 'dynamo/daos';
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
      const userByName = await userDao.getByUsername(req.body.username.toLowerCase());

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

    // Fetch user with sensitive data to preserve email field during update
    const userToUpdate = await userDao.getByIdWithSensitiveData(user.id);

    if (!userToUpdate) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/user/account');
    }

    userToUpdate.username = req.body.username;
    userToUpdate.usernameLower = req.body.username.toLowerCase();
    userToUpdate.about = req.body.body;
    if (req.body.image) {
      userToUpdate.imageName = req.body.image;
    }
    await userDao.update(userToUpdate as any);

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
