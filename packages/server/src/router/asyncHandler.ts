import express from 'express';

/**
 * Wraps a route handler/middleware so that a thrown error OR a rejected promise is
 * forwarded to Express's error-handling middleware via next(err), with the request still
 * in scope. Express 4 does not catch async rejections on its own — without this they
 * become process-level unhandledRejections (no request context, no response), which is
 * why slow/failing async handlers previously hung or double-sent after the request
 * timeout fired. The async function form catches both synchronous throws and rejections.
 */
export const asyncHandler =
  (fn: express.RequestHandler): express.RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

/**
 * Wraps a route's handler (a single function or an array of middleware) so every stage is
 * covered by asyncHandler. Returns an array suitable for passing to router[method]().
 */
export const wrapHandlers = (
  handler: express.RequestHandler | express.RequestHandler[],
): express.RequestHandler[] => (Array.isArray(handler) ? handler : [handler]).map(asyncHandler);
