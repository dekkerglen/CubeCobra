import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';
import crypto from 'crypto';

// Mock the daos the handler pulls from dynamo/daos. patronDao.update (not put) is the fix
// for the root-cause bug: the record already exists, and put is insert-only.
jest.mock('../../src/dynamo/daos', () => ({
  patronDao: {
    getByEmail: jest.fn(),
    update: jest.fn(),
    put: jest.fn(),
  },
  userDao: {
    getByIdWithSensitiveData: jest.fn(),
    update: jest.fn(),
  },
}));

import { patronDao, userDao } from '../../src/dynamo/daos';
import { hookHandler, isPatreonHookPath } from '../../src/router/routes/patreon';
import { call } from '../test-utils/transport';

const EMAIL = 'patron@example.com';
const OWNER = 'user-123';

// Build a request partial with a valid Patreon signature over the raw JSON bytes.
const signed = (event: string, payload: any) => {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto
    .createHmac('md5', process.env.PATREON_HOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');
  return {
    headers: { 'x-patreon-event': event, 'x-patreon-signature': signature },
    rawBody,
    body: payload,
  };
};

// A current (v2) member payload. `included` carries the linked user and any entitled tiers.
const memberPayload = (opts: { status: string; tiers?: { id: string; title: string }[] }) => ({
  data: {
    type: 'member',
    id: 'member-1',
    attributes: { email: EMAIL, patron_status: opts.status },
    relationships: {
      user: { data: { id: OWNER, type: 'user' } },
      currently_entitled_tiers: { data: (opts.tiers ?? []).map((t) => ({ id: t.id, type: 'tier' })) },
    },
  },
  included: [
    { type: 'user', id: OWNER, attributes: { email: EMAIL, full_name: 'Test Patron' } },
    ...(opts.tiers ?? []).map((t) => ({ type: 'tier', id: t.id, attributes: { title: t.title } })),
  ],
});

// A deprecated (v1) pledge payload, still deliverable from the queued backlog.
const pledgePayload = (opts: { reward?: { id: string; title: string } }) => ({
  data: {
    type: 'pledge',
    id: 'pledge-1',
    relationships: {
      patron: { data: { id: OWNER, type: 'user' } },
      ...(opts.reward ? { reward: { data: { id: opts.reward.id, type: 'reward' } } } : {}),
    },
  },
  included: [
    { type: 'user', id: OWNER, attributes: { email: EMAIL } },
    ...(opts.reward ? [{ type: 'reward', id: opts.reward.id, attributes: { title: opts.reward.title } }] : []),
  ],
});

describe('patreon hookHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (patronDao.getByEmail as jest.Mock).mockResolvedValue({
      owner: OWNER,
      email: EMAIL,
      level: PatronLevels['Lotus Cobra'],
      status: PatronStatuses.ACTIVE,
      dateCreated: 1,
      dateLastUpdated: 1,
    });
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({
      id: OWNER,
      roles: [UserRoles.PATRON],
    });
  });

  it('rejects a request with an invalid signature', async () => {
    const req = signed('members:pledge:delete', memberPayload({ status: 'former_patron' }));
    req.headers['x-patreon-signature'] = 'deadbeef';

    const { status } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(401);
    expect(patronDao.update).not.toHaveBeenCalled();
    expect(userDao.update).not.toHaveBeenCalled();
  });

  it('deactivates the patron on members:pledge:delete', async () => {
    const req = signed('members:pledge:delete', memberPayload({ status: 'former_patron' }));

    const { status, body } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(200);
    expect(body).toEqual({ success: 'true' });
    // The record already exists → must be updated, not inserted.
    expect(patronDao.put).not.toHaveBeenCalled();
    expect(patronDao.update).toHaveBeenCalledWith(expect.objectContaining({ status: PatronStatuses.INACTIVE }));
    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ roles: [] }));
  });

  it('activates and sets the level on members:pledge:create for an active Lotus Cobra patron', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({ id: OWNER, roles: [] });
    const req = signed(
      'members:pledge:create',
      memberPayload({ status: 'active_patron', tiers: [{ id: 'tier-lotus', title: 'Lotus Cobra' }] }),
    );

    const { status } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(200);
    expect(patronDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: PatronStatuses.ACTIVE, level: PatronLevels['Lotus Cobra'] }),
    );
    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ roles: [UserRoles.PATRON] }));
  });

  it('deactivates when patron_status is not active on an update', async () => {
    const req = signed('members:pledge:update', memberPayload({ status: 'declined_patron' }));

    const { status } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(200);
    expect(patronDao.update).toHaveBeenCalledWith(expect.objectContaining({ status: PatronStatuses.INACTIVE }));
  });

  it('still processes deprecated v1 pledges:delete events from the backlog', async () => {
    const req = signed('pledges:delete', pledgePayload({}));

    const { status } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(200);
    expect(patronDao.update).toHaveBeenCalledWith(expect.objectContaining({ status: PatronStatuses.INACTIVE }));
  });

  it('acknowledges an unrelated event without touching the database', async () => {
    const req = signed('posts:publish', { data: { type: 'post', id: 'p1' } });

    const { status } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(200);
    expect(patronDao.getByEmail).not.toHaveBeenCalled();
    expect(patronDao.update).not.toHaveBeenCalled();
  });

  it('acknowledges (200) when no patron matches the email so Patreon does not retry', async () => {
    (patronDao.getByEmail as jest.Mock).mockResolvedValue(undefined);
    const req = signed('members:pledge:delete', memberPayload({ status: 'former_patron' }));

    const { status } = await call(hookHandler).withRequest(req).send();

    expect(status).toBe(200);
    expect(patronDao.update).not.toHaveBeenCalled();
  });
});

// Guards the raw-body capture predicate used by the body-parser `verify` hook. Patreon's
// registered URL is uppercase `/PATREON/HOOK`; if this does not match, rawBody is never
// captured and every real webhook 401s. This is the case the original fix missed.
describe('isPatreonHookPath', () => {
  it('matches the real uppercase Patreon URL', () => {
    expect(isPatreonHookPath('/PATREON/HOOK')).toBe(true);
  });

  it('matches the lowercase path', () => {
    expect(isPatreonHookPath('/patreon/hook')).toBe(true);
  });

  it('matches mixed case and a trailing query string', () => {
    expect(isPatreonHookPath('/Patreon/Hook?foo=bar')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(isPatreonHookPath('/patreon/redirect')).toBe(false);
    expect(isPatreonHookPath('/cube/list/foo')).toBe(false);
  });
});
