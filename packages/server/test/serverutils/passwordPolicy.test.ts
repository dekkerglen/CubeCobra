import bcrypt from 'bcryptjs';

import {
  comparePassword,
  DUMMY_PASSWORD_HASH,
  newAccountToken,
  tokensMatch,
} from '../../src/serverutils/passwordPolicy';

describe('comparePassword', () => {
  const hash = bcrypt.hashSync('right password', 4);

  it('matches only the right password', async () => {
    expect(await comparePassword('right password', hash)).toBe(true);
    expect(await comparePassword('wrong password', hash)).toBe(false);
  });

  it('treats a missing or malformed hash and a non-string password as a mismatch', async () => {
    expect(await comparePassword('anything', undefined)).toBe(false);
    expect(await comparePassword('anything', 'not-a-bcrypt-hash')).toBe(false);
    expect(await comparePassword(undefined, hash)).toBe(false);
    expect(await comparePassword(['right password'], hash)).toBe(false);
  });

  it('runs a real bcrypt comparison when there is no account', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    await comparePassword('anything', undefined);
    expect(spy).toHaveBeenCalledWith('anything', DUMMY_PASSWORD_HASH);
    spy.mockRestore();
  });

  it('ships a dummy hash at the same cost as real ones', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(10);
  });
});

describe('account tokens', () => {
  it('generates long, unique, URL-safe tokens', () => {
    const a = newAccountToken();
    const b = newAccountToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('matches only an identical, non-empty token', () => {
    const token = newAccountToken();
    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(token, `${token}x`)).toBe(false);
    expect(tokensMatch(token, newAccountToken())).toBe(false);
    expect(tokensMatch('', '')).toBe(false);
    expect(tokensMatch(undefined, undefined)).toBe(false);
    expect(tokensMatch(token, undefined)).toBe(false);
  });
});
