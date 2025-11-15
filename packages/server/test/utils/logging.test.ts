import { sanitizeHttpBody } from 'serverutils/logging';

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
});
