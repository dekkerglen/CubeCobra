import crypto from 'crypto';

// Stateless HMAC token that grants permission to contribute a deck to a record.
// Derived from the record id + the server secret, so it needs no storage and
// can't be guessed; it's only ever revealed to the owner via the share modal.
const secret = (): string => process.env.SESSION || 'default-secret';

export const signRecordToken = (recordId: string): string =>
  crypto.createHmac('sha256', secret()).update(`record-contribute:${recordId}`).digest('base64url');

export const verifyRecordToken = (recordId: string, token: string): boolean => {
  if (!token) {
    return false;
  }
  const expected = Buffer.from(signRecordToken(recordId));
  const provided = Buffer.from(token);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
};
