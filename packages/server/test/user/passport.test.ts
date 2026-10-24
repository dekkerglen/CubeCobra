import { UserRoles } from '@utils/datatypes/User';
import bcrypt from 'bcryptjs';

jest.mock('../../src/dynamo/daos', () => ({
  userDao: {
    getByUsername: jest.fn(),
    getByEmail: jest.fn(),
    getByIdWithSensitiveData: jest.fn(),
    getByIdForSession: jest.fn(),
  },
}));

import {
  BANNED_MESSAGE,
  deserializeSessionUser,
  LOGIN_FAILED_MESSAGE,
  renewSession,
  serializeSessionUser,
  UNVERIFIED_MESSAGE,
  verifyLogin,
} from '../../src/config/passport';
import { userDao } from '../../src/dynamo/daos';
import { DUMMY_PASSWORD_HASH } from '../../src/serverutils/passwordPolicy';
import { createUser } from '../test-utils/data';
import { createMockRequest } from '../test-utils/transport';

const PASSWORD = 'correct horse battery';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

const runVerify = (username: string, password: string) =>
  new Promise<{ err: any; user: any; info: any }>((resolve) => {
    verifyLogin(username, password, (err, user, info) => resolve({ err, user, info }));
  });

const runDeserialize = (serialized: unknown) =>
  new Promise<any>((resolve) => {
    deserializeSessionUser(serialized, (_err, user) => resolve(user));
  });

describe('verifyLogin (local strategy)', () => {
  const user = createUser({ id: 'user-1', username: 'alice' });

  beforeEach(() => {
    jest.clearAllMocks();
    (userDao.getByUsername as jest.Mock).mockResolvedValue(user);
    (userDao.getByEmail as jest.Mock).mockResolvedValue(null);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({
      ...user,
      email: 'alice@example.com',
      passwordHash: PASSWORD_HASH,
      emailVerified: true,
      sessionVersion: 3,
    });
  });

  it('logs in with the right password and pins the session version', async () => {
    const { err, user: result } = await runVerify('alice', PASSWORD);

    expect(err).toBeNull();
    expect(result).toEqual({ ...user, sessionVersion: 3 });
    expect(result.passwordHash).toBeUndefined();
    expect(result.email).toBeUndefined();
  });

  it('gives the same answer for an unknown account and a wrong password', async () => {
    const wrong = await runVerify('alice', 'wrong password');

    (userDao.getByUsername as jest.Mock).mockResolvedValue(null);
    const unknown = await runVerify('nobody', PASSWORD);

    expect(wrong.user).toBe(false);
    expect(unknown.user).toBe(false);
    expect(wrong.info).toEqual({ message: LOGIN_FAILED_MESSAGE });
    expect(unknown.info).toEqual({ message: LOGIN_FAILED_MESSAGE });
  });

  it('still runs bcrypt (against a dummy hash) when no account matches', async () => {
    (userDao.getByUsername as jest.Mock).mockResolvedValue(null);
    const spy = jest.spyOn(bcrypt, 'compare');

    await runVerify('nobody', PASSWORD);

    expect(userDao.getByEmail).toHaveBeenCalledWith('nobody');
    expect(spy).toHaveBeenCalledWith(PASSWORD, DUMMY_PASSWORD_HASH);
    spy.mockRestore();
  });

  it('finds the account by email', async () => {
    (userDao.getByUsername as jest.Mock).mockResolvedValue(null);
    (userDao.getByEmail as jest.Mock).mockResolvedValue(user);

    const { user: result } = await runVerify('alice@example.com', PASSWORD);

    expect(result).toEqual(expect.objectContaining({ id: 'user-1' }));
  });

  it('refuses a banned account, but only after the right password', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({
      ...user,
      passwordHash: PASSWORD_HASH,
      roles: [UserRoles.BANNED],
    });

    expect((await runVerify('alice', PASSWORD)).info).toEqual({ message: BANNED_MESSAGE });
    expect((await runVerify('alice', 'wrong password')).info).toEqual({ message: LOGIN_FAILED_MESSAGE });
  });

  it('reports an unverified email only after the right password', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({
      ...user,
      passwordHash: PASSWORD_HASH,
      emailVerified: false,
    });

    expect((await runVerify('alice', PASSWORD)).info).toEqual({ message: UNVERIFIED_MESSAGE });
    expect((await runVerify('alice', 'wrong password')).info).toEqual({ message: LOGIN_FAILED_MESSAGE });
  });

  it('passes database errors to passport', async () => {
    const failure = new Error('dynamo down');
    (userDao.getByUsername as jest.Mock).mockRejectedValue(failure);

    expect((await runVerify('alice', PASSWORD)).err).toBe(failure);
  });
});

describe('session serialization', () => {
  const user = createUser({ id: 'user-1' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes the id with the session version', () => {
    const done = jest.fn();
    serializeSessionUser({ ...user, sessionVersion: 2 }, done);
    expect(done).toHaveBeenCalledWith(null, 'user-1:2');

    serializeSessionUser(user, done);
    expect(done).toHaveBeenLastCalledWith(null, 'user-1:0');
  });

  it('accepts a session at the current version', async () => {
    (userDao.getByIdForSession as jest.Mock).mockResolvedValue({ user, sessionVersion: 2 });

    expect(await runDeserialize('user-1:2')).toBe(user);
    expect(userDao.getByIdForSession).toHaveBeenCalledWith('user-1');
  });

  it('rejects a session from before a password or email change', async () => {
    (userDao.getByIdForSession as jest.Mock).mockResolvedValue({ user, sessionVersion: 2 });

    expect(await runDeserialize('user-1:1')).toBe(false);
  });

  it('accepts a session ahead of an eventually consistent read', async () => {
    (userDao.getByIdForSession as jest.Mock).mockResolvedValue({ user, sessionVersion: 2 });

    expect(await runDeserialize('user-1:3')).toBe(user);
  });

  it('accepts a legacy plain-id session only while the user has never bumped their version', async () => {
    (userDao.getByIdForSession as jest.Mock).mockResolvedValue({ user, sessionVersion: 0 });
    expect(await runDeserialize('user-1')).toBe(user);

    (userDao.getByIdForSession as jest.Mock).mockResolvedValue({ user, sessionVersion: 1 });
    expect(await runDeserialize('user-1')).toBe(false);
  });

  it('rejects missing users, malformed values and lookup errors', async () => {
    (userDao.getByIdForSession as jest.Mock).mockResolvedValue(undefined);
    expect(await runDeserialize('user-1:0')).toBe(false);

    (userDao.getByIdForSession as jest.Mock).mockResolvedValue({ user, sessionVersion: 0 });
    expect(await runDeserialize('user-1:abc')).toBe(false);
    expect(await runDeserialize('')).toBe(false);
    expect(await runDeserialize({ id: 'user-1' })).toBe(false);

    (userDao.getByIdForSession as jest.Mock).mockRejectedValue(new Error('dynamo down'));
    expect(await runDeserialize('user-1:0')).toBe(false);
  });
});

describe('renewSession', () => {
  it('re-issues the acting session at the new version', async () => {
    const user = createUser({ id: 'user-1' });
    const login = jest.fn((_user, _options, cb) => cb());
    const req = createMockRequest({ user, login } as any);

    await renewSession(req, 'user-1', 4);

    expect(login).toHaveBeenCalledWith(
      { ...user, sessionVersion: 4 },
      { session: true, keepSessionInfo: true },
      expect.any(Function),
    );
  });

  it('leaves other sessions alone', async () => {
    const login = jest.fn();
    await renewSession(createMockRequest({ user: createUser({ id: 'someone-else' }), login } as any), 'user-1', 4);
    await renewSession(createMockRequest({ login } as any), 'user-1', 4);

    expect(login).not.toHaveBeenCalled();
  });

  it('logs and resolves when the session cannot be saved', async () => {
    const req = createMockRequest({
      user: createUser({ id: 'user-1' }),
      login: jest.fn((_user, _options, cb) => cb(new Error('store down'))),
    } as any);

    await expect(renewSession(req, 'user-1', 4)).resolves.toBeUndefined();
    expect(req.logger.error).toHaveBeenCalled();
  });
});
