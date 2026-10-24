import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { body } from 'express-validator';

export const PASSWORD_MIN_LENGTH = 8;

// bcrypt only reads the first 72 bytes of a password and silently ignores the rest, so a
// longer password would be weaker than it looks.
export const PASSWORD_MAX_BYTES = 72;

// Matches the cost the register and reset routes have always used.
export const BCRYPT_COST = 10;

// A real bcrypt hash (same cost) of a random password nobody knows. Login compares against it
// when no account matches, so an unknown username takes as long to reject as a wrong password.
export const DUMMY_PASSWORD_HASH = '$2a$10$Ul2UN6yC4mNA40BtvWcBRuDvvRKoi7kf2CFKE.QHlDgauzAXkeA5m';

/**
 * Returns why `password` can't be used as a new password, or null when it's fine. Applies only
 * to passwords being set: an existing password is checked against its hash whatever its length.
 */
export const passwordPolicyError = (password: unknown): string | null => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `Password is too long. Please use at most ${PASSWORD_MAX_BYTES} characters (accented letters, emoji and some symbols count as more than one).`;
  }
  return null;
};

/** express-validator check that applies the password policy to a new-password field. */
export const newPasswordValidator = (field: string) =>
  body(field).custom((value: unknown) => {
    const error = passwordPolicyError(value);
    if (error) {
      throw new Error(error);
    }
    return true;
  });

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_COST);

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
