import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const INTERNAL_TOKEN_HEADER = 'X-Internal-Token';

/** Constant-time comparison of a presented token against the expected one. */
export const tokenMatches = (presented: unknown, expected: string): boolean => {
  if (typeof presented !== 'string') {
    return false;
  }
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Requires callers to present the shared secret in the X-Internal-Token header. When no secret is
 * configured (RECOMMENDER_SHARED_SECRET unset, e.g. local dev or before the secret is
 * provisioned) every request is allowed, as before. During a rotation the previous value
 * (RECOMMENDER_SHARED_SECRET_PREVIOUS) is accepted too, so callers can switch over gradually.
 */
export const requireInternalToken =
  (
    secrets: string | (string | undefined)[] | undefined = [
      process.env.RECOMMENDER_SHARED_SECRET,
      process.env.RECOMMENDER_SHARED_SECRET_PREVIOUS,
    ],
  ) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const accepted = (Array.isArray(secrets) ? secrets : [secrets]).filter((value): value is string => !!value);
    const presented = req.get(INTERNAL_TOKEN_HEADER);
    if (accepted.length === 0 || accepted.some((secret) => tokenMatches(presented, secret))) {
      next();
      return;
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
  };
