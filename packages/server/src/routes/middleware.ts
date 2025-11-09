import csurf from 'csurf';
import { validationResult } from 'express-validator';
import User from 'dynamo/models/user';
import { UserRoles } from '@utils/datatypes/User';
import Joi from 'joi';
import { NextFunction, Request, Response } from '../types/express';
import { redirect } from 'serverutils/render';

export const ensureAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    return next();
  }

  req.flash('danger', 'Please login to view this content');
  return redirect(req, res, '/user/login');
};

export const ensureAuthJson = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(403).json({ error: 'You must be logged in.' });
  return;
};

export const ensureRole =
  (role: UserRoles) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated()) {
      req.flash('danger', 'Please login to view this content');
      return redirect(req, res, '/user/login');
    }

    const user = await User.getById(req.user!.id);

    if (user && user.roles && user.roles.includes(role)) {
      return next();
    }
    return redirect(req, res, '/404');
  };

export const csrfProtection = [
  csurf(),
  (req: Request, res: Response, next: NextFunction): void => {
    const { nickname } = req.body;

    if (nickname !== undefined && nickname !== 'Your Nickname') {
      // probably a malicious request
      req.flash('danger', 'Invalid request');

      return redirect(req, res, '/');
    }

    res.locals.csrfToken = req.csrfToken();
    return next();
  },
];

const questions = [
  'What card type attacks and blocks?',
  "What is the name of Magic's discard pile?",
  'What color of mana does a Plains produce?',
  'What color of mana does a Island produce?',
  'What color of mana does a Swamp produce?',
  'What color of mana does a Mountain produce?',
  'What color of mana does a Forest produce?',
  'What is the name of the basic land that produces white mana?',
  'What is the name of the basic land that produces blue mana?',
  'What is the name of the basic land that produces black mana?',
  'What is the name of the basic land that produces red mana?',
  'What is the name of the basic land that produces green mana?',
];

const answers = [
  'creature', // 'What card type attacks and blocks?'
  'graveyard', // "What is the name of Magic's discard pile?"
  'white', // 'What color of mana does a Plains produce?'
  'blue', // 'What color of mana does a Island produce?'
  'black', // 'What color of mana does a Swamp produce?'
  'red', // 'What color of mana does a Mountain produce?'
  'green', // 'What color of mana does a Forest produce?'
  'plains', // 'What is the name of the basic land that produces white mana?'
  'island', // 'What is the name of the basic land that produces blue mana?'
  'swamp', // 'What is the name of the basic land that produces black mana?'
  'mountain', // 'What is the name of the basic land that produces red mana?'
  'forest', // 'What is the name of the basic land that produces green mana?'
];

export async function recaptcha(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { captcha, question, answer } = req.body;

  if (!question || !answer) {
    req.flash('danger', 'Please answer the security question');
    return redirect(req, res, '/');
  }

  const index = questions.indexOf(question);

  if (index === -1 || !answer || !answers[index] || answers[index].toLowerCase() !== answer.toLowerCase()) {
    req.flash('danger', 'Incorrect answer to security question');
    return redirect(req, res, '/');
  }

  if (!captcha) {
    req.flash('danger', 'Please complete the reCAPTCHA');
    return redirect(req, res, '/');
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `secret=${process.env.CAPTCHA_SECRET_KEY}&response=${captcha}`,
  });

  const data = await response.json();

  if (!data.success) {
    req.flash('danger', 'Failed reCAPTCHA verification');
    return redirect(req, res, '/');
  }

  next();
}

export function flashValidationErrors(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  req.validated = errors.isEmpty();

  for (const error of errors.array()) {
    req.flash('danger', error);
  }

  next();
}

export function jsonValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  if (!errors.isEmpty()) {
    res.status(400).send({
      success: 'false',
      errors: errors.array(),
    });
    req.validated = false;
    return;
  }

  req.validated = true;
  next();
}

export const bodyValidation =
  (schema: Joi.Schema<any>, redirectUrlFn?: (req: Request) => string, path?: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const { error } = path ? schema.validate(JSON.parse(req.body[path])) : schema.validate(req.body);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Validation error:', error);

      if (redirectUrlFn) {
        req.flash('danger', error.details[0]?.message || 'Validation error');
        return redirect(req, res, redirectUrlFn(req));
      }

      return res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    }
    next();
  };
