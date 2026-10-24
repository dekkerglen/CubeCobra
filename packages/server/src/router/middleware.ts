import { UserRoles } from '@utils/datatypes/User';
import { canUseImageHosting } from '@utils/hostedImagesUtil';
import { patronDao, userDao } from 'dynamo/daos';
import { validationResult } from 'express-validator';
import Joi from 'joi';
import { clientIp } from 'serverutils/clientIp';
import { redirect } from 'serverutils/render';

import { NextFunction, Request, Response } from '../types/express';

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Guards a route on the shape of a path parameter.
 *
 * Express 4 allowed an inline constraint in the path itself, e.g.
 * `/:date([0-9]{4}-[0-9]{2}-[0-9]{2})`. path-to-regexp v8, which Express 5 uses, removed that
 * syntax. A non-matching request used to mean "this route does not match", so Express carried
 * on looking at later routes and ultimately fell through to the 404 handler. `next('route')`
 * reproduces exactly that: it abandons this route and resumes matching at the next one.
 */
export const matchParam =
  (name: string, pattern: RegExp) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[name];
    if (typeof value !== 'string' || !pattern.test(value)) {
      return next('route');
    }
    return next();
  };

export const rejectBannedUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.roles?.includes(UserRoles.BANNED)) {
    return next();
  }

  // logout regenerates the session, so the flash lands in the fresh, logged-out one.
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash(
      'danger',
      'Your account has been banned, please contact CubeCobra staff if you believe this is in error.',
    );
    return redirect(req, res, '/');
  });
};

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

    const user = await userDao.getById(req.user!.id);

    if (user && user.roles && user.roles.includes(role)) {
      return next();
    }
    return redirect(req, res, '/404');
  };

// Gates a JSON route behind the image-hosting perk (active Lotus Cobra patron, or Admin).
export const ensureImageHosting = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(403).json({ success: 'false', message: 'You must be logged in.' });
    return;
  }

  const patron = await patronDao.getById(req.user.id);
  if (!canUseImageHosting(patron, req.user.roles)) {
    res.status(403).json({ success: 'false', message: 'Image hosting is a Lotus Cobra Patreon perk.' });
    return;
  }

  return next();
};

// Cross-site request forgery is blocked globally by serverutils/csrf (Origin / Sec-Fetch-Site
// checks), so this no longer issues tokens. It remains on form routes for the honeypot field
// that catches naive bots, and keeps res.locals.csrfToken defined for the client props.
export const csrfProtection = [
  (req: Request, res: Response, next: NextFunction): void => {
    const { nickname } = req.body;

    if (nickname !== undefined && nickname !== 'Your Nickname') {
      // probably a malicious request
      req.flash('danger', 'Invalid request');

      return redirect(req, res, '/');
    }

    res.locals.csrfToken = '';
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

// Bot-security gate (security question + reCAPTCHA) for public form posts.
// On failure it flashes the reason and redirects to `redirectTo` — which must be a page
// that renders <DynamicFlash />, otherwise the message is set but never shown. That gap
// previously sent failed registrations to the landing page (no DynamicFlash), so users saw
// no error and assumed signup succeeded. Callers pass the originating form's path.
// A token solved on another site that uses the same (or a test) site key is still a valid
// token; Google reports where it was solved, so require it to be this site.
const isExpectedCaptchaHost = (hostname: unknown): boolean => {
  if (!process.env.DOMAIN) {
    return true;
  }
  let expected: string;
  try {
    expected = new URL(`http://${process.env.DOMAIN}`).hostname;
  } catch {
    return true;
  }
  return hostname === expected || hostname === `www.${expected}`;
};

export function recaptcha(redirectTo = '/') {
  return async function recaptchaMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Skip bot security checks if disabled (for testing)
    if (process.env.ENABLE_BOT_SECURITY === 'false') {
      return next();
    }

    const { captcha, question, answer } = req.body;

    if (!question || !answer) {
      req.flash('danger', 'Please answer the security question');
      return redirect(req, res, redirectTo);
    }

    const index = questions.indexOf(question);

    if (
      index === -1 ||
      typeof answer !== 'string' ||
      !answers[index] ||
      answers[index].toLowerCase() !== answer.trim().toLowerCase()
    ) {
      req.flash('danger', 'Incorrect answer to security question');
      return redirect(req, res, redirectTo);
    }

    if (!captcha || typeof captcha !== 'string') {
      req.flash('danger', 'Please complete the reCAPTCHA');
      return redirect(req, res, redirectTo);
    }

    // URLSearchParams encodes the client-supplied token, so it can't smuggle extra
    // parameters (a second `secret`, a forged `remoteip`) into the verification request.
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: process.env.CAPTCHA_SECRET_KEY ?? '',
        response: captcha,
        remoteip: clientIp(req),
      }),
    });

    const data = await response.json();

    if (!data.success || !isExpectedCaptchaHost(data.hostname)) {
      req.flash('danger', 'Failed reCAPTCHA verification');
      return redirect(req, res, redirectTo);
    }

    next();
  };
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

const invalidJsonError = { details: [{ message: 'Invalid request data' }] };

export const bodyValidation =
  (schema: Joi.Schema<any>, redirectUrlFn?: (req: Request) => string, path?: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    let payload: unknown = req.body;
    if (path) {
      try {
        payload = JSON.parse(req.body[path]);
      } catch {
        payload = undefined;
      }
    }
    const { error } = payload === undefined && path ? { error: invalidJsonError } : schema.validate(payload);

    if (error) {
      console.error('Validation error:', error);

      if (redirectUrlFn) {
        req.flash('danger', error.details[0]?.message || 'Validation error');
        return redirect(req, res, redirectUrlFn(req));
      }

      return res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    }
    next();
  };
