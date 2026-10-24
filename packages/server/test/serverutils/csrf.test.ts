import { evaluateCsrf } from 'serverutils/csrf';

const makeReq = ({
  method = 'POST',
  path = '/cube/api/commit',
  headers = {},
  user,
}: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  user?: object;
}) =>
  ({
    method,
    path,
    user,
    get: (name: string) => headers[name.toLowerCase()],
  }) as any;

describe('evaluateCsrf', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, DOMAIN: 'cubecobra.com', HTTP_ONLY: 'false' };
    delete process.env.CSRF_TRUSTED_ORIGINS;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('allows safe methods regardless of headers', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(evaluateCsrf(makeReq({ method, headers: { 'sec-fetch-site': 'cross-site' } })).allowed).toBe(true);
    }
  });

  it('allows same-origin requests by Sec-Fetch-Site', () => {
    expect(evaluateCsrf(makeReq({ headers: { 'sec-fetch-site': 'same-origin' }, user: {} })).allowed).toBe(true);
  });

  it('blocks cross-site form posts', () => {
    const verdict = evaluateCsrf(
      makeReq({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }, user: {} }),
    );
    expect(verdict.allowed).toBe(false);
  });

  it('blocks cross-site requests even without a session (login CSRF)', () => {
    expect(
      evaluateCsrf(
        makeReq({ path: '/user/login', headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' } }),
      ).allowed,
    ).toBe(false);
  });

  it('allows the www and apex origins when Sec-Fetch-Site is same-site', () => {
    expect(
      evaluateCsrf(
        makeReq({ headers: { 'sec-fetch-site': 'same-site', origin: 'https://www.cubecobra.com' }, user: {} }),
      ).allowed,
    ).toBe(true);
  });

  it('blocks sibling subdomains', () => {
    expect(
      evaluateCsrf(
        makeReq({ headers: { 'sec-fetch-site': 'same-site', origin: 'https://beta.cubecobra.com' }, user: {} }),
      ).allowed,
    ).toBe(false);
  });

  it('falls back to Origin when Sec-Fetch-Site is absent', () => {
    expect(evaluateCsrf(makeReq({ headers: { origin: 'https://cubecobra.com' }, user: {} })).allowed).toBe(true);
    expect(evaluateCsrf(makeReq({ headers: { origin: 'https://evil.example' }, user: {} })).allowed).toBe(false);
  });

  it('treats an opaque "null" origin as cross-site', () => {
    expect(evaluateCsrf(makeReq({ headers: { origin: 'null' }, user: {} })).allowed).toBe(false);
  });

  it('falls back to Referer when there is neither Sec-Fetch-Site nor Origin', () => {
    expect(evaluateCsrf(makeReq({ headers: { referer: 'https://cubecobra.com/cube/list/x' }, user: {} })).allowed).toBe(
      true,
    );
    expect(evaluateCsrf(makeReq({ headers: { referer: 'https://evil.example/page' }, user: {} })).allowed).toBe(false);
  });

  it('allows non-browser clients that are not riding a session', () => {
    expect(evaluateCsrf(makeReq({ path: '/patreon/hook' })).allowed).toBe(true);
  });

  it('blocks authenticated requests that carry no provenance headers', () => {
    expect(evaluateCsrf(makeReq({ user: { id: 'u1' } })).allowed).toBe(false);
  });

  it('honors CSRF_TRUSTED_ORIGINS', () => {
    process.env.CSRF_TRUSTED_ORIGINS = 'https://partner.example';
    expect(
      evaluateCsrf(
        makeReq({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://partner.example' }, user: {} }),
      ).allowed,
    ).toBe(true);
  });

  it('uses http origins for HTTP_ONLY development', () => {
    process.env.DOMAIN = 'localhost:8080';
    process.env.HTTP_ONLY = 'true';
    expect(evaluateCsrf(makeReq({ headers: { origin: 'http://localhost:8080' }, user: {} })).allowed).toBe(true);
  });

  it('exempts CSP reports', () => {
    expect(evaluateCsrf(makeReq({ path: '/api/cspreport', user: {} })).allowed).toBe(true);
  });
});
