jest.mock('../../src/dynamo/daos', () => ({
  patronDao: {
    getById: jest.fn(),
    getByEmail: jest.fn(),
    getByPatreonUserId: jest.fn(),
    put: jest.fn(),
    deleteById: jest.fn(),
  },
  userDao: {
    getByIdWithSensitiveData: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

import { patronDao, userDao } from '../../src/dynamo/daos';
import { linkHandler, redirectHandler, routes } from '../../src/router/routes/patreon';
import { redirect } from '../../src/serverutils/render';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const ORIGINAL_ENV = { ...process.env };
const user = createUser({ id: 'user-1' });
const STATE = '0123456789abcdef0123456789abcdef';

const redirectedTo = (): string => {
  const calls = (redirect as jest.Mock).mock.calls;
  return calls[calls.length - 1]?.[2];
};

// Patreon's token exchange and identity calls, in order.
const mockPatreon = (identity: any) => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => identity });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const activeIdentity = {
  data: { id: 'patreon-9', attributes: { email: 'Patron@Example.com' } },
  included: [{ type: 'member', id: 'm-1', attributes: { patron_status: 'active_patron' } }],
};

describe('Patreon linking', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PATREON_CLIENT_ID = 'client-id';
    process.env.PATREON_REDIRECT = 'https://cubecobra.com/patreon/redirect';
    (patronDao.getById as jest.Mock).mockResolvedValue(undefined);
    (patronDao.getByEmail as jest.Mock).mockResolvedValue(undefined);
    (patronDao.getByPatreonUserId as jest.Mock).mockResolvedValue(undefined);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({ ...user, roles: [] });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = originalFetch;
  });

  describe('GET /patreon/link', () => {
    it('stores a random state in the session and sends it to Patreon', async () => {
      const session: Record<string, any> = {};

      await call(linkHandler)
        .as(user)
        .withFlash(jest.fn())
        .withRequest({ session } as any)
        .send();

      expect(session.patreonOAuthState).toMatch(/^[0-9a-f]{32}$/);
      const url = new URL(redirectedTo());
      expect(url.origin + url.pathname).toBe('https://www.patreon.com/oauth2/authorize');
      expect(url.searchParams.get('state')).toBe(session.patreonOAuthState);
      expect(url.searchParams.get('client_id')).toBe('client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://cubecobra.com/patreon/redirect');
      expect(url.searchParams.get('scope')).toBe('identity identity[email]');
    });

    it('issues a different state each time', async () => {
      const first: Record<string, any> = {};
      const second: Record<string, any> = {};
      await call(linkHandler)
        .as(user)
        .withRequest({ session: first } as any)
        .send();
      await call(linkHandler)
        .as(user)
        .withRequest({ session: second } as any)
        .send();

      expect(first.patreonOAuthState).not.toBe(second.patreonOAuthState);
    });

    it('explains when linking is not configured', async () => {
      delete process.env.PATREON_CLIENT_ID;
      const flash = jest.fn();

      await call(linkHandler)
        .as(user)
        .withFlash(flash)
        .withRequest({ session: {} } as any)
        .send();

      expect(flash).toHaveBeenCalledWith('danger', expect.any(String));
      expect(redirectedTo()).toBe('/user/account?nav=patreon');
    });
  });

  describe('GET /patreon/redirect', () => {
    const arrive = (query: Record<string, string>, session: Record<string, any>) =>
      call(redirectHandler)
        .as(user)
        .withFlash(jest.fn())
        .withRequest({ query, session } as any)
        .send();

    it('refuses a callback without the state from this session', async () => {
      const fetchMock = mockPatreon(activeIdentity);

      const { rawRequest } = await arrive({ code: 'grant' }, { patreonOAuthState: STATE });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(patronDao.put).not.toHaveBeenCalled();
      expect(rawRequest.flash).toHaveBeenCalledWith('danger', expect.stringMatching(/try linking again/));
    });

    it('refuses a callback whose state does not match, and burns the stored state', async () => {
      const fetchMock = mockPatreon(activeIdentity);
      const session: Record<string, any> = { patreonOAuthState: STATE };

      await arrive({ code: 'grant', state: STATE.replace('0', '1') }, session);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(session.patreonOAuthState).toBeUndefined();
    });

    it('refuses a callback when no link was started', async () => {
      const fetchMock = mockPatreon(activeIdentity);

      await arrive({ code: 'grant', state: STATE }, {});

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('only accepts unlink as a POST', () => {
    const unlink = routes.filter((route) => route.path === '/unlink');
    expect(unlink.map((route) => route.method)).toEqual(['post']);
  });
});
