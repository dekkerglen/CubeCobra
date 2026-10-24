import crypto from 'crypto';

import type { NextFunction, Request, Response } from '../types/express';

/**
 * Content-Security-Policy.
 *
 * Enforced now: the directives that can't break the site — no framing by other origins
 * (clickjacking), no plugins, and no <base> injection.
 *
 * Report-only for now: a nonce-based script policy. The ad network injects scripts from many
 * hosts, so this has to be observed before it can be enforced; 'strict-dynamic' lets scripts
 * loaded by a nonce'd script through, and the https:/'unsafe-inline' fallbacks only apply to
 * browsers too old to understand nonces. Every <script> in views/main.pug carries the nonce.
 */
export const cspHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    [
      `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
      "object-src 'none'",
      "base-uri 'self'",
      'report-uri /api/cspreport',
    ].join('; '),
  );
  next();
};
