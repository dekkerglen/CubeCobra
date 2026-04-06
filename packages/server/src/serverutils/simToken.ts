import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.SESSION || 'dev-sim-token-secret';
const TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours — covers the longest possible simulation

/**
 * Create a short-lived HMAC token authorising userId to run simulation on cubeId.
 * Returned by simulatesetup; passed in every simulateall request to avoid per-pick
 * DynamoDB lookups.
 */
export function createSimToken(userId: string, cubeId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${cubeId}:${expiry}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

/**
 * Returns true iff the token was issued by this server for the given userId+cubeId
 * and has not yet expired.
 */
export function verifySimToken(token: string, userId: string, cubeId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon === -1) return false;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);

    const parts = payload.split(':');
    if (parts.length !== 3) return false;
    const [tokenUserId, tokenCubeId, expiryStr] = parts as [string, string, string];

    if (tokenUserId !== userId || tokenCubeId !== cubeId) return false;
    if (Date.now() > parseInt(expiryStr, 10)) return false;

    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sig, 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}
