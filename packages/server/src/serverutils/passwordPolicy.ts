import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// A real bcrypt hash (same cost) of a random password nobody knows. Login compares against it
// when no account matches, so an unknown username takes as long to reject as a wrong password.
export const DUMMY_PASSWORD_HASH = '$2a$10$Ul2UN6yC4mNA40BtvWcBRuDvvRKoi7kf2CFKE.QHlDgauzAXkeA5m';

/**
 * Compares a password against a stored hash, treating a missing or malformed hash (or a
 * non-string password) as a mismatch instead of an error. Always does the full bcrypt work,
 * against the dummy hash when there's nothing to compare, so the timing doesn't reveal
 * whether an account exists.
 */
export const comparePassword = async (password: unknown, hash: string | undefined): Promise<boolean> => {
  const candidate = typeof password === 'string' ? password : '';
  try {
    const isMatch = await bcrypt.compare(candidate, hash || DUMMY_PASSWORD_HASH);
    return isMatch && !!hash && typeof password === 'string';
  } catch {
    return false;
  }
};

/** A single-use secret for an emailed link (email verification, email change confirmation). */
export const newAccountToken = (): string => crypto.randomBytes(32).toString('base64url');

/** Constant-time comparison of an emailed token against the stored one. Empty never matches. */
export const tokensMatch = (stored: unknown, provided: unknown): boolean => {
  if (typeof stored !== 'string' || typeof provided !== 'string' || !stored || !provided) {
    return false;
  }
  const expected = Buffer.from(stored);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};
