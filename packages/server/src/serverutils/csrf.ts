import type { NextFunction, Request, Response } from '../types/express';
import { render } from './render';

/*
 * Cross-site request forgery protection without tokens.
 *
 * The old csurf setup kept a secret in the session and expected every form and fetch to echo
 * a token rendered into the page. That broke whenever the two drifted apart (anonymous
 * sessions that were never saved, pages served from cache, sessions that expired while a tab
 * stayed open), which surfaced as intermittent "invalid csrf token" errors.
 *
 * Every current browser already tells the server where a request came from:
 *   - Sec-Fetch-Site (all evergreen browsers; Safari since 16.4) says whether the request was
 *     initiated by a page on this same origin;
 *   - Origin is sent on every cross-origin request and on all POSTs;
 *   - Referer is the last-resort fallback for very old browsers.
 * A forged request from another site cannot set or suppress these, so checking them on
 * state-changing methods is a complete CSRF defense that needs no per-session state and can't
 * go stale. The session cookie is also SameSite=Lax as a second layer.
 *
 * Requests that carry none of these headers did not come from a browser page (the Patreon
 * webhook, the daily-jobs Lambda, Draftmancer's server); they are allowed only when they are
 * not authenticated by a session cookie, since a cookie is the only thing a forger could ride.
 *
 * CSRF_MODE=report logs would-be rejections without blocking, as an escape hatch.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Browser-generated reports carry no user intent and change nothing.
const EXEMPT_PATHS = new Set(['/api/cspreport']);

const allowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  const domain = process.env.DOMAIN;
  if (domain) {
    const scheme = process.env.HTTP_ONLY === 'true' ? 'http' : 'https';
    origins.add(`${scheme}://${domain}`);
    origins.add(`${scheme}://www.${domain}`);
  }
  for (const origin of (process.env.CSRF_TRUSTED_ORIGINS ?? '').split(',')) {
    if (origin.trim()) origins.add(origin.trim());
  }
  return origins;
};

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export interface CsrfVerdict {
  allowed: boolean;
  reason: string;
}

export const evaluateCsrf = (req: Request): CsrfVerdict => {
  if (SAFE_METHODS.has(req.method)) {
    return { allowed: true, reason: 'safe-method' };
  }
  if (EXEMPT_PATHS.has(req.path)) {
    return { allowed: true, reason: 'exempt-path' };
  }

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'same-origin') {
    return { allowed: true, reason: 'sec-fetch-site' };
  }

  // Sec-Fetch-Site of same-site/cross-site (or absent) — decide on the declared origin, so
  // www vs apex and explicitly trusted origins still work.
  const origin = req.get('origin');
  if (origin && origin !== 'null') {
    return allowedOrigins().has(origin)
      ? { allowed: true, reason: 'origin' }
      : { allowed: false, reason: `origin ${origin}` };
  }
  if (fetchSite === 'cross-site' || fetchSite === 'same-site' || origin === 'null') {
    return { allowed: false, reason: `sec-fetch-site ${fetchSite ?? 'none'}, origin ${origin ?? 'none'}` };
  }

  const referer = req.get('referer');
  if (referer) {
    const refererOrigin = originOf(referer);
    return refererOrigin && allowedOrigins().has(refererOrigin)
      ? { allowed: true, reason: 'referer' }
      : { allowed: false, reason: `referer ${refererOrigin ?? 'invalid'}` };
  }

  // No provenance headers at all: not a browser page. Fine unless it rides a login session.
  return req.user
    ? { allowed: false, reason: 'no provenance headers on an authenticated request' }
    : { allowed: true, reason: 'non-browser client' };
};

const wantsJson = (req: Request): boolean =>
  req.is('application/json') === 'application/json' ||
  req.get('sec-fetch-mode') === 'cors' ||
  (req.get('accept') ?? '').includes('application/json');

export const csrfGuard = (req: Request, res: Response, next: NextFunction): void => {
  const verdict = evaluateCsrf(req);
  if (verdict.allowed) {
    next();
    return;
  }

  req.logger?.info('Blocked cross-site request', {
    csrf: verdict.reason,
    method: req.method,
    path: req.path,
    secFetchSite: req.get('sec-fetch-site') ?? null,
  });

  if (process.env.CSRF_MODE === 'report') {
    next();
    return;
  }

  res.status(403);
  if (wantsJson(req)) {
    res.json({ success: 'false', message: 'This request did not come from Cube Cobra and was blocked.' });
    return;
  }
  render(
    req,
    res,
    'ErrorPage',
    {
      error:
        'This request did not come from Cube Cobra and was blocked. If you followed a link or submitted a form here, go back and try again from the site.',
      requestId: req.uuid,
      title: 'Request blocked',
    },
    { noindex: true },
  );
};
