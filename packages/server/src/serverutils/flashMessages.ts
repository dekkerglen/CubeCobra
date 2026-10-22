import express from 'express';

/**
 * Exposes the session's flash messages to Pug as `messages()`.
 *
 * Replaces `express-messages`, which built its markup with `res.render(...)` and returned the
 * callback's output synchronously. Express 5's `View.prototype.render` deliberately defers the
 * view-engine callback via `process.nextTick` ("force callback to be async"), so that helper
 * always returned an empty string — after having already drained `req.flash()`. Every flash
 * message on the site was therefore silently swallowed, so failed registrations and logins
 * re-rendered the form with no error shown.
 *
 * `messages` stays a function rather than a precomputed value so the drain happens while the
 * template renders — after route handlers have flashed their messages, and exactly once per
 * response.
 */
export const flashMessages = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  res.locals.messages = () => req.flash();
  next();
};

export default flashMessages;
