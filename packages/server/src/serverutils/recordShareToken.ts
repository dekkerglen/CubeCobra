import crypto from 'crypto';

// Stateless HMAC token that grants permission to contribute a deck to a record.
// Derived from the record id + a server secret, so it needs no storage and
// can't be guessed; it's only ever revealed to the owner via the share modal.
//
// RECORD_TOKEN_SECRET is the dedicated key. Links were originally signed with the session
// secret, so SESSION remains the fallback to keep them working; setting RECORD_TOKEN_SECRET
// later revokes every existing link at once without signing anyone out.

// Only used outside production when neither secret is set: tokens stay unguessable and simply
// stop working when the process restarts.
let developmentSecret: string | undefined;

// Used exactly as configured (not trimmed): existing links were signed with the raw SESSION value.
const nonBlank = (value: string | undefined): string | undefined => (value && value.trim() ? value : undefined);

const secret = (): string | null => {
  const configured = nonBlank(process.env.RECORD_TOKEN_SECRET) ?? nonBlank(process.env.SESSION);
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  developmentSecret ??= crypto.randomBytes(32).toString('hex');
  return developmentSecret;
};

const sign = (key: string, recordId: string): string =>
  crypto.createHmac('sha256', key).update(`record-contribute:${recordId}`).digest('base64url');

/** Throws when no signing secret is configured in production, rather than issue a forgeable token. */
export const signRecordToken = (recordId: string): string => {
  const key = secret();
  if (!key) {
    throw new Error('Record share links are unavailable: RECORD_TOKEN_SECRET (or SESSION) is not set');
  }
  return sign(key, recordId);
};

export const verifyRecordToken = (recordId: string, token: string): boolean => {
  const key = secret();
  if (!token || !key) {
    return false;
  }
  const expected = Buffer.from(sign(key, recordId));
  const provided = Buffer.from(token);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
};
