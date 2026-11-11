import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';

import type { Request, Response } from '../types/express';
import { clientIp } from './clientIp';
import { userOrIpKey } from './rateLimitKeys';
import { redirect } from './render';

/** Rate-limit key: the client IP (IPv6 collapsed to its /56), never the user. */
export const ipKey = (req: ExpressRequest): string => ipKeyGenerator(clientIp(req)) ?? 'anon';

/**
 * Limiter for JSON endpoints: answers 429 with a JSON body. Keyed by user when logged in,
 * IP otherwise, unless a key generator is supplied.
 */
export const jsonLimiter = (
  windowMs: number,
  limit: number,
  keyGenerator: (req: ExpressRequest) => string = userOrIpKey,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({ success: 'false', message: 'Too many requests. Please wait a moment and try again.' });
    },
  });

/**
 * Limiter for form posts and pages: flashes a message and redirects instead of returning a
 * bare 429. Keyed by IP unless a key generator is supplied; `options` passes further
 * express-rate-limit settings through.
 */
export const formLimiter = (
  windowMs: number,
  limit: number,
  redirectTo: string | ((req: Request) => string),
  keyGenerator: (req: ExpressRequest) => string = ipKey,
  options: Partial<Options> = {},
) =>
  rateLimit({
    ...options,
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
      const request = req as unknown as Request;
      request.flash('danger', 'Too many attempts. Please wait a few minutes and try again.');
      return redirect(request, res as Response, typeof redirectTo === 'function' ? redirectTo(request) : redirectTo);
    },
  });

/** Limiter for anonymous-friendly GET endpoints that are expensive to serve (images, search). */
export const expensiveGetLimiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: userOrIpKey,
    message: '429: Too Many Requests',
  });

// Filters with /regex/ clauses cost the most to run over the whole catalog, so requests that use them also share one
// tighter limit across every endpoint that does that. Spotting ":/" in the raw text is enough to pick the limit
// without parsing; a quoted ":/" just counts against it too.
const regexFilterRequests = jsonLimiter(60_000, 30);

export const regexFilterLimiter =
  (filterText: (req: ExpressRequest) => unknown) => (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const text = filterText(req);
    return typeof text === 'string' && text.includes(':/') ? regexFilterRequests(req, res, next) : next();
  };
