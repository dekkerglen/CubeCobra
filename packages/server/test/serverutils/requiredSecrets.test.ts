import { assertRequiredSecrets, missingRequiredSecrets } from 'serverutils/requiredSecrets';

describe('requiredSecrets', () => {
  it('requires nothing outside production', () => {
    expect(missingRequiredSecrets({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('requires SESSION and the captcha secret in production', () => {
    expect(missingRequiredSecrets({ NODE_ENV: 'production' })).toEqual(['SESSION', 'CAPTCHA_SECRET_KEY']);
    expect(missingRequiredSecrets({ NODE_ENV: 'production', SESSION: '  ', CAPTCHA_SECRET_KEY: 'x' })).toEqual([
      'SESSION',
    ]);
  });

  it('does not require the captcha secret when bot security is disabled', () => {
    expect(missingRequiredSecrets({ NODE_ENV: 'production', SESSION: 's', ENABLE_BOT_SECURITY: 'false' })).toEqual([]);
  });

  it('throws naming the missing secrets', () => {
    expect(() => assertRequiredSecrets({ NODE_ENV: 'production', CAPTCHA_SECRET_KEY: 'x' })).toThrow(/SESSION/);
    expect(() =>
      assertRequiredSecrets({ NODE_ENV: 'production', SESSION: 's', CAPTCHA_SECRET_KEY: 'x' }),
    ).not.toThrow();
  });
});
