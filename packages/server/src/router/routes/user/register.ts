import { DefaultPrintingPreference } from '@utils/datatypes/Card';
import { DefaultGridTightnessPreference } from '@utils/datatypes/User';
import bcrypt from 'bcryptjs';
import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors, recaptcha } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { hasProfanity, validateEmail } from 'serverutils/util';
import { v4 as uuid } from 'uuid';

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

export const getHandler = (req: Request, res: Response) => {
  return render(req, res, 'RegisterPage');
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    // Validate that required fields are strings
    if (typeof req.body.email !== 'string' || !req.body.email) {
      req.flash('danger', 'Email must not be empty.');
      return render(req, res, 'RegisterPage', {});
    }
    if (typeof req.body.username !== 'string' || !req.body.username) {
      req.flash('danger', 'Username must not be empty.');
      return render(req, res, 'RegisterPage', { email: req.body.email });
    }
    if (typeof req.body.password !== 'string' || !req.body.password) {
      req.flash('danger', 'Password must not be empty.');
      return render(req, res, 'RegisterPage', { email: req.body.email, username: req.body.username });
    }

    const email = req.body.email.toLowerCase();
    const { username, password } = req.body;

    const attempt = { email, username };

    if (!req.validated) {
      return render(req, res, 'RegisterPage', attempt);
    }

    try {
      validateEmail(email);
    } catch (err) {
      req.flash('danger', (err as Error).message);
      return render(req, res, 'RegisterPage', attempt);
    }

    const userByName = await userDao.getByUsername(req.body.username.toLowerCase());

    if (userByName) {
      req.flash('danger', 'username already taken.');
      return render(req, res, 'RegisterPage', attempt);
    }

    // check if user exists
    const user = await userDao.getByEmail(req.body.email.toLowerCase());

    if (user) {
      req.flash('danger', 'email already associated with an existing account.');
      return render(req, res, 'RegisterPage', attempt);
    }

    const skipVerification = process.env.ENABLE_BOT_SECURITY === 'false';

    const newUser = {
      email,
      username,
      followedCubes: [],
      followedUsers: [],
      following: [],
      hideFeatured: false,
      hideTagColors: false,
      imageName: 'Ambush Viper',
      roles: [],
      theme: 'default',
      emailVerified: skipVerification,
      token: uuid(),
      dateCreated: new Date().valueOf(),
      defaultPrinting: DefaultPrintingPreference,
      gridTightness: DefaultGridTightnessPreference,
      autoBlog: false,
    };

    const salt = await bcrypt.genSalt(10);
    (newUser as any).passwordHash = await bcrypt.hash(password, salt);
    const id = await userDao.createUser(newUser);

    if (!skipVerification) {
      await sendEmail(email, 'Please verify your new Cube Cobra account', 'confirm_email', {
        id,
        token: newUser.token,
      });
    }

    req.flash(
      'success',
      skipVerification
        ? 'Account successfully created. You can now login.'
        : 'Account successfully created. Please check your email for a verification link to login.',
    );
    return redirect(req, res, '/user/login');
  } catch (err) {
    handleRouteError(req, res, err as Error, '/user/register');
  }
};

export const confirmHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.token) {
      req.flash('danger', 'Invalid confirmation link');
      return redirect(req, res, '/user/login');
    }

    const user = await userDao.getByIdWithSensitiveData(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/user/login');
    }

    if (user.token !== req.params.token) {
      req.flash('danger', 'Invalid token');
      return redirect(req, res, '/user/login');
    }

    user.emailVerified = true;
    await userDao.update(user);

    req.flash('success', 'Email verified. You can now login.');
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/user/login');
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
    handler: [
      csrfProtection,
      body('email', 'email is required').notEmpty(),
      body('email', 'email is not valid').isEmail(),
      body('email', 'email must be between 5 and 100 characters.').isLength({
        min: 5,
        max: 100,
      }),
      body('password', 'Password is required').notEmpty(),
      body('password', 'Password must be between 8 and 1024 characters.').isLength({
        min: 8,
        max: 1024,
      }),
      body('password2', 'Confirm Password is required').notEmpty(),
      body('password2', 'Confirm Password must match password.').custom((value: string, { req }: any) => {
        return value === req.body.password;
      }),
      ...usernameValid,
      recaptcha,
      flashValidationErrors,
      postHandler,
    ],
  },
  {
    path: '/confirm/:id/:token',
    method: 'get',
    handler: [csrfProtection, confirmHandler],
  },
];
