import { DefaultPrintingPreference } from '@utils/datatypes/Card';
import { DefaultGridTightnessPreference } from '@utils/datatypes/User';
import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors, recaptcha } from 'router/middleware';
import { trackServerEvent } from 'serverutils/analytics';
import sendEmail from 'serverutils/email';
import { hashPassword, newAccountToken, newPasswordValidator, tokensMatch } from 'serverutils/passwordPolicy';
import { formLimiter } from 'serverutils/rateLimiters';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { hasProfanity, validateEmail } from 'serverutils/util';

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
  return render(req, res, 'RegisterPage', {}, { title: 'Register' });
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    // Validate that required fields are strings
    if (typeof req.body.email !== 'string' || !req.body.email) {
      req.flash('danger', 'Email must not be empty.');
      return render(req, res, 'RegisterPage', {}, { title: 'Register' });
    }
    if (typeof req.body.username !== 'string' || !req.body.username) {
      req.flash('danger', 'Username must not be empty.');
      return render(req, res, 'RegisterPage', { email: req.body.email }, { title: 'Register' });
    }
    if (typeof req.body.password !== 'string' || !req.body.password) {
      req.flash('danger', 'Password must not be empty.');
      return render(
        req,
        res,
        'RegisterPage',
        { email: req.body.email, username: req.body.username },
        { title: 'Register' },
      );
    }

    const email = req.body.email.toLowerCase();
    const { username, password } = req.body;

    const attempt = { email, username };

    if (!req.validated) {
      return render(req, res, 'RegisterPage', attempt, { title: 'Register' });
    }

    try {
      validateEmail(email);
    } catch (err) {
      req.flash('danger', (err as Error).message);
      return render(req, res, 'RegisterPage', attempt, { title: 'Register' });
    }

    const userByName = await userDao.getByUsername(req.body.username.toLowerCase());

    if (userByName) {
      req.flash('danger', 'username already taken.');
      return render(req, res, 'RegisterPage', attempt, { title: 'Register' });
    }

    // check if user exists
    const user = await userDao.getByEmail(req.body.email.toLowerCase());

    if (user) {
      req.flash('danger', 'email already associated with an existing account.');
      return render(req, res, 'RegisterPage', attempt, { title: 'Register' });
    }

    const skipVerification = process.env.ENABLE_BOT_SECURITY === 'false';

    const newUser = {
      email,
      username,
      followerCount: 0,
      followingCount: 0,
      likedCubesCount: 0,
      hideFeatured: false,
      imageName: 'Ambush Viper',
      roles: [],
      theme: 'system',
      emailVerified: skipVerification,
      token: newAccountToken(),
      dateCreated: new Date().valueOf(),
      defaultPrinting: DefaultPrintingPreference,
      gridTightness: DefaultGridTightnessPreference,
      autoBlog: false,
      disableAnimations: false,
    };

    (newUser as any).passwordHash = await hashPassword(password);
    const id = await userDao.createUser(newUser);

    trackServerEvent('sign_up', { method: 'email' }, { clientId: id, logger: req.logger });

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

// One answer for every failure (unknown user, wrong token, link already used), so the link
// can't be used to probe accounts.
const INVALID_CONFIRMATION =
  'This verification link is no longer valid. If you have already verified your email, you can log in.';

export const confirmHandler = async (req: Request, res: Response) => {
  try {
    const user = req.params.id ? await userDao.getByIdWithSensitiveData(req.params.id) : undefined;

    // The token is cleared once used, so a verified account never matches.
    if (!user || !tokensMatch(user.token, req.params.token)) {
      req.flash('danger', INVALID_CONFIRMATION);
      return redirect(req, res, '/user/login');
    }

    user.emailVerified = true;
    user.token = '';
    await userDao.update(user);

    req.flash('success', 'Email verified. You can now login.');
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/user/login');
  }
};

// Generous enough for a group signing up from one venue's network.
const registerLimiter = formLimiter(60 * 60 * 1000, 20, '/user/register');
const confirmLimiter = formLimiter(15 * 60 * 1000, 30, '/user/login');

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
      registerLimiter,
      csrfProtection,
      body('email', 'email is required').notEmpty(),
      body('email', 'email is not valid').isEmail(),
      body('email', 'email must be between 5 and 100 characters.').isLength({
        min: 5,
        max: 100,
      }),
      body('password', 'Password is required').notEmpty(),
      newPasswordValidator('password'),
      body('password2', 'Confirm Password is required').notEmpty(),
      body('password2', 'Confirm Password must match password.').custom((value: string, { req }: any) => {
        return value === req.body.password;
      }),
      ...usernameValid,
      // Return failures to the register form (renders <DynamicFlash />) so the user sees the
      // error and their entry, instead of being silently dropped on the landing page.
      recaptcha('/user/register'),
      flashValidationErrors,
      postHandler,
    ],
  },
  {
    path: '/confirm/:id/:token',
    method: 'get',
    handler: [confirmLimiter, csrfProtection, confirmHandler],
  },
];
