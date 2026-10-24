import { sanitizeHttpBody, sanitizeUrl } from 'serverutils/logging';

describe('sanitizeHttpBody', () => {
  it('should be fine with undefined or empty body', () => {
    expect(sanitizeHttpBody(undefined)).toEqual(undefined);
    expect(sanitizeHttpBody({})).toEqual({});
  });

  it('strips sensitive fields such as password', () => {
    const body = {
      id: 'foobar',
      password: 'mypassword',
      password2: 'mypassword',
    };
    const originalBody = structuredClone(body);

    const sanitizedBody = sanitizeHttpBody(body);
    expect(sanitizedBody).toEqual({
      id: 'foobar',
    });
    //Original body has not been modified
    expect(body).toEqual(originalBody);
  });

  it('strips credentials at any depth, including numbered passwords and API keys', () => {
    expect(
      sanitizeHttpBody({
        password3: 'new',
        apiKey: 'k',
        captcha: 'c',
        nested: { token: 't', keep: 1, list: [{ secret: 's', name: 'x' }] },
      }),
    ).toEqual({ nested: { keep: 1, list: [{ name: 'x' }] } });
  });
});

describe('sanitizeUrl', () => {
  it('drops the query string', () => {
    expect(sanitizeUrl('/cube/records/contribute/abc?token=secret')).toBe('/cube/records/contribute/abc');
  });

  it('masks secret-bearing path segments', () => {
    expect(sanitizeUrl('/user/passwordreset/1234-abcd')).toBe('/user/passwordreset/[redacted]');
    expect(sanitizeUrl('/user/register/confirm/uid/tok')).toBe('/user/register/confirm/[redacted]');
  });

  it('leaves ordinary paths alone', () => {
    expect(sanitizeUrl('/cube/list/abc')).toBe('/cube/list/abc');
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });
});
