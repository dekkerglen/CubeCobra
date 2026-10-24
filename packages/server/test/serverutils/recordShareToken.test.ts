import crypto from 'crypto';

const ORIGINAL_ENV = { ...process.env };

// The secret is read on every call, but the development fallback is cached per module
// instance, so each test gets a fresh copy of the module.
const loadModule = (): typeof import('../../src/serverutils/recordShareToken') => {
  let mod: typeof import('../../src/serverutils/recordShareToken') | undefined;
  jest.isolateModules(() => {
    mod = require('../../src/serverutils/recordShareToken');
  });
  return mod!;
};

const legacySign = (secret: string, recordId: string) =>
  crypto.createHmac('sha256', secret).update(`record-contribute:${recordId}`).digest('base64url');

describe('recordShareToken', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('signs with RECORD_TOKEN_SECRET when it is set', () => {
    process.env.RECORD_TOKEN_SECRET = 'record-secret';
    process.env.SESSION = 'session-secret';
    const { signRecordToken, verifyRecordToken } = loadModule();

    const token = signRecordToken('record-1');
    expect(token).toBe(legacySign('record-secret', 'record-1'));
    expect(verifyRecordToken('record-1', token)).toBe(true);
    // Links signed with the session secret are revoked once a dedicated secret is set.
    expect(verifyRecordToken('record-1', legacySign('session-secret', 'record-1'))).toBe(false);
  });

  it('falls back to SESSION so existing share links keep working', () => {
    delete process.env.RECORD_TOKEN_SECRET;
    process.env.SESSION = 'session-secret';
    const { verifyRecordToken } = loadModule();

    expect(verifyRecordToken('record-1', legacySign('session-secret', 'record-1'))).toBe(true);
    expect(verifyRecordToken('record-2', legacySign('session-secret', 'record-1'))).toBe(false);
  });

  it('never signs with the old guessable default', () => {
    delete process.env.RECORD_TOKEN_SECRET;
    delete process.env.SESSION;
    process.env.NODE_ENV = 'development';
    const { signRecordToken, verifyRecordToken } = loadModule();

    const token = signRecordToken('record-1');
    expect(token).not.toBe(legacySign('default-secret', 'record-1'));
    expect(verifyRecordToken('record-1', token)).toBe(true);
    expect(verifyRecordToken('record-1', legacySign('default-secret', 'record-1'))).toBe(false);
  });

  it('refuses to issue or accept tokens in production without a secret', () => {
    delete process.env.RECORD_TOKEN_SECRET;
    process.env.SESSION = '   ';
    process.env.NODE_ENV = 'production';
    const { signRecordToken, verifyRecordToken } = loadModule();

    expect(() => signRecordToken('record-1')).toThrow(/not set/);
    expect(verifyRecordToken('record-1', legacySign('default-secret', 'record-1'))).toBe(false);
    expect(verifyRecordToken('record-1', legacySign('   ', 'record-1'))).toBe(false);
  });

  it('rejects an empty token', () => {
    process.env.SESSION = 'session-secret';
    const { verifyRecordToken } = loadModule();
    expect(verifyRecordToken('record-1', '')).toBe(false);
  });
});
