import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';

jest.mock('../../src/dynamo/daos', () => ({
  patronDao: {
    getById: jest.fn(),
    getByEmail: jest.fn(),
    getByPatreonUserId: jest.fn(),
    update: jest.fn(),
    put: jest.fn(),
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
import { redirectHandler } from '../../src/router/routes/patreon';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const OWNER = 'user-123';
const EMAIL = 'patron@example.com';
// The OAuth state that /patreon/link stored in the session and Patreon echoes back.
const STATE = '0123456789abcdef0123456789abcdef';

const identity = (email: string) => ({
  data: { attributes: { email } },
  included: [
    {
      type: 'member',
      id: 'member-1',
      attributes: { patron_status: 'active_patron' },
      relationships: { currently_entitled_tiers: { data: [{ id: 'tier-1', type: 'tier' }] } },
    },
    { type: 'tier', id: 'tier-1', attributes: { title: 'Lotus Cobra' } },
  ],
});

const mockPatreonApi = (email: string) => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => identity(email) }) as unknown as typeof fetch;
};

const inactivePatron = (email: string) => ({
  owner: OWNER,
  email,
  level: PatronLevels['Patron'],
  status: PatronStatuses.INACTIVE,
  dateCreated: 1,
  dateLastUpdated: 1,
});

describe('patreon redirectHandler', () => {
  const originalFetch = global.fetch;
  const flash = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({ id: OWNER, roles: [] });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const send = () =>
    call(redirectHandler)
      .as(createUser({ id: OWNER }))
      .withFlash(flash)
      .withRequest({ session: { patreonOAuthState: STATE } } as any)
      .withQuery({ code: 'grant', state: STATE })
      .send();

  it('creates a new patron record when the user has never linked', async () => {
    mockPatreonApi(EMAIL);
    (patronDao.getById as jest.Mock).mockResolvedValue(undefined);
    (patronDao.getByEmail as jest.Mock).mockResolvedValue(undefined);

    await send();

    expect(patronDao.put).toHaveBeenCalledWith(
      expect.objectContaining({ owner: OWNER, email: EMAIL, status: PatronStatuses.ACTIVE }),
    );
    expect(patronDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('success', expect.anything());
  });

  it('reactivates a lapsed patron record linked with a different email', async () => {
    mockPatreonApi('new@example.com');
    (patronDao.getById as jest.Mock).mockResolvedValue(inactivePatron(EMAIL));
    (patronDao.getByEmail as jest.Mock).mockResolvedValue(undefined);

    await send();

    expect(patronDao.put).not.toHaveBeenCalled();
    expect(patronDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: OWNER,
        email: 'new@example.com',
        status: PatronStatuses.ACTIVE,
        level: PatronLevels['Lotus Cobra'],
        dateCreated: 1,
      }),
    );
    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ roles: [UserRoles.PATRON] }));
    expect(flash).toHaveBeenCalledWith('success', expect.anything());
  });

  it('reactivates a lapsed patron record re-linked with the same email', async () => {
    mockPatreonApi(EMAIL);
    (patronDao.getById as jest.Mock).mockResolvedValue(inactivePatron(EMAIL));
    (patronDao.getByEmail as jest.Mock).mockResolvedValue(inactivePatron(EMAIL));

    await send();

    expect(patronDao.put).not.toHaveBeenCalled();
    expect(patronDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ owner: OWNER, email: EMAIL, status: PatronStatuses.ACTIVE }),
    );
    expect(flash).toHaveBeenCalledWith('success', expect.anything());
  });

  it('rejects an email already linked to a different account', async () => {
    mockPatreonApi(EMAIL);
    (patronDao.getById as jest.Mock).mockResolvedValue(undefined);
    (patronDao.getByEmail as jest.Mock).mockResolvedValue({ ...inactivePatron(EMAIL), owner: 'someone-else' });

    await send();

    expect(patronDao.put).not.toHaveBeenCalled();
    expect(patronDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('another Cube Cobra account'));
  });
});
