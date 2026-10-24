import bcrypt from 'bcryptjs';
import express from 'express';
import { validationResult } from 'express-validator';

import {
  comparePassword,
  DUMMY_PASSWORD_HASH,
  matchesSecret,
  newAccountToken,
  newPasswordValidator,
  passwordPolicyError,
  tokensMatch,
} from '../../src/serverutils/passwordPolicy';

const runValidator = async (field: string, value: unknown) => {
  const req = { body: { [field]: value } } as unknown as express.Request;
  await newPasswordValidator(field).run(req);
  return validationResult(req)
    .array()
    .map((error) => error.msg);
};

describe('passwordPolicyError', () => {
  it('accepts a password between 8 characters and 72 bytes', () => {
    expect(passwordPolicyError('correct horse')).toBeNull();
    expect(passwordPolicyError('a'.repeat(8))).toBeNull();
    expect(passwordPolicyError('a'.repeat(72))).toBeNull();
  });

  it('rejects short, missing and non-string passwords', () => {
    expect(passwordPolicyError('a'.repeat(7))).toMatch(/at least 8/);
    expect(passwordPolicyError('')).toMatch(/at least 8/);
    expect(passwordPolicyError(undefined)).toMatch(/at least 8/);
    expect(passwordPolicyError(['longenough'])).toMatch(/at least 8/);
  });

  it('measures the upper limit in bytes, which is what bcrypt reads', () => {
    expect(passwordPolicyError('a'.repeat(73))).toMatch(/too long/);
    // 25 three-byte characters: only 25 characters long, but 75 bytes.
    expect(passwordPolicyError('€'.repeat(25))).toMatch(/too long/);
    expect(passwordPolicyError('€'.repeat(24))).toBeNull();
  });
});

describe('newPasswordValidator', () => {
  it('reports the policy message for the named field', async () => {
    expect(await runValidator('password2', 'short')).toEqual(['Password must be at least 8 characters long.']);
    expect(await runValidator('password2', 'long enough')).toEqual([]);
  });
});

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

describe('matchesSecret', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('accepts the current key, and the previous key only while it is set', () => {
    process.env = { ...OLD_ENV, TEST_API_KEY: 'new-key', TEST_API_KEY_PREVIOUS: 'old-key' };
    expect(matchesSecret('TEST_API_KEY', 'new-key')).toBe(true);
    expect(matchesSecret('TEST_API_KEY', 'old-key')).toBe(true);
    expect(matchesSecret('TEST_API_KEY', 'other')).toBe(false);

    delete process.env.TEST_API_KEY_PREVIOUS;
    expect(matchesSecret('TEST_API_KEY', 'old-key')).toBe(false);
  });

  it('never matches when the key is unset', () => {
    process.env = { ...OLD_ENV };
    delete process.env.TEST_API_KEY;
    delete process.env.TEST_API_KEY_PREVIOUS;
    expect(matchesSecret('TEST_API_KEY', '')).toBe(false);
    expect(matchesSecret('TEST_API_KEY', undefined)).toBe(false);
  });
});
