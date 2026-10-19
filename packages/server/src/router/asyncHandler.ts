import express from 'express';

/**
 * Wraps a route handler/middleware so that a thrown error OR a rejected promise is
 * forwarded to Express's error-handling middleware via next(err), with the request still
 * in scope. Express 5 forwards rejected promises from handlers on its own, but this wrapper
 * is kept so behaviour does not depend on that difference and so handlers typed against the
 * app's own Request (which narrows `params`) can still be registered.
 *
 * The parameter type is deliberately loose: route handlers are written against the local
 * Request/Response interfaces in types/express, which are not assignable to Express's own
 * RequestHandler now that `params` is narrowed to ParamsFlatDictionary. This function is the
 * single adapter at that boundary.
 */
type LooseRequestHandler = (req: any, res: any, next: express.NextFunction) => void | Promise<void>;

export const asyncHandler =
  (fn: LooseRequestHandler): express.RequestHandler =>
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
 *
 * Handler entries may themselves be arrays of middleware (e.g. `csrfProtection`), and those
 * arrays can be nested. Express flattens nested handler arrays natively, but here we wrap
 * each stage individually, so we must flatten first — otherwise asyncHandler would receive an
 * array instead of a function and calling it throws "fn is not a function" at request time.
 */
export const wrapHandlers = (handler: LooseRequestHandler | LooseRequestHandler[]): express.RequestHandler[] =>
  (Array.isArray(handler) ? handler : [handler]).flat(Infinity).map(asyncHandler);
