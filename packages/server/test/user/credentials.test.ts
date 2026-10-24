import bcrypt from 'bcryptjs';

jest.mock('../../src/dynamo/daos', () => ({
  userDao: {
    getByIdWithSensitiveData: jest.fn(),
    getByEmail: jest.fn(),
    update: jest.fn(),
  },
  passwordResetDao: {
    getById: jest.fn(),
    deleteById: jest.fn(),
    putAndReturnId: jest.fn(),
  },
}));
jest.mock('serverutils/email', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));
jest.mock('passport', () => ({
  __esModule: true,
  default: { authenticate: jest.fn() },
}));

import passport from 'passport';

import { passwordResetDao, userDao } from '../../src/dynamo/daos';
import { loginAccountKey, postHandler as loginHandler } from '../../src/router/routes/user/login';
import {
  emailRequestKey,
  LOST_PASSWORD_SENT,
  postHandler as lostPasswordHandler,
} from '../../src/router/routes/user/lostpassword';
import { confirmHandler } from '../../src/router/routes/user/register';
import { postHandler as resendHandler, VERIFICATION_SENT } from '../../src/router/routes/user/resendverification';
import sendEmail from '../../src/serverutils/email';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const PASSWORD = 'current password';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const user = createUser({ id: 'user-1', username: 'alice' });

const storedUser = (overrides: Record<string, any> = {}) => ({
  ...user,
  email: 'alice@example.com',
  passwordHash: PASSWORD_HASH,
  emailVerified: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('email verification (register confirm)', () => {
  const TOKEN = 'v'.repeat(43);

  it('verifies with the right token and clears it so the link is single use', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(
      storedUser({ emailVerified: false, token: TOKEN }),
    );
    const flash = jest.fn();

    await call(confirmHandler).withFlash(flash).withParams({ id: 'user-1', token: TOKEN }).send();

    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: true, token: '' }));
    expect(flash).toHaveBeenCalledWith('success', expect.any(String));
  });

  it.each([
    ['a wrong token', { token: TOKEN }, 'w'.repeat(43)],
    ['a used (cleared) token', { token: undefined }, TOKEN],
    ['an empty token on an account without one', { token: '' }, ''],
  ])('rejects %s', async (_label, overrides, provided) => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(
      storedUser({ emailVerified: false, ...overrides }),
    );
    const flash = jest.fn();

    await call(confirmHandler).withFlash(flash).withParams({ id: 'user-1', token: provided }).send();

    expect(userDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/no longer valid/));
  });
});

describe('resend verification', () => {
  const send = (email: string) =>
    call(resendHandler).withFlash(jest.fn()).withRequest({ validated: true, body: { email } }).send();

  it('reads the token from the full record and mails it', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(user);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(
      storedUser({ emailVerified: false, token: 'stored-token' }),
    );
    (sendEmail as jest.Mock).mockResolvedValue(undefined);

    const { rawRequest } = await send('Alice@Example.com');

    expect(sendEmail).toHaveBeenCalledWith('alice@example.com', expect.any(String), 'confirm_email', {
      id: 'user-1',
      token: 'stored-token',
    });
    expect(rawRequest.flash).toHaveBeenCalledWith('success', VERIFICATION_SENT);
  });

  it('gives the same answer for unknown and already verified addresses, and sends nothing', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(null);
    const unknown = await send('nobody@example.com');

    (userDao.getByEmail as jest.Mock).mockResolvedValue(user);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ emailVerified: true }));
    const verified = await send('alice@example.com');

    expect(sendEmail).not.toHaveBeenCalled();
    expect(unknown.rawRequest.flash).toHaveBeenCalledWith('success', VERIFICATION_SENT);
    expect(verified.rawRequest.flash).toHaveBeenCalledWith('success', VERIFICATION_SENT);
  });

  it('issues a fresh random token when an unverified account has none', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(user);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ emailVerified: false }));
    (sendEmail as jest.Mock).mockResolvedValue(undefined);

    await send('alice@example.com');

    const token = (userDao.update as jest.Mock).mock.calls[0][0].token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sendEmail).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'confirm_email', {
      id: 'user-1',
      token,
    });
  });
});

describe('lost password', () => {
  const send = (email: string) =>
    call(lostPasswordHandler).withFlash(jest.fn()).withRequest({ validated: true, body: { email } }).send();

  it('logs (instead of failing the request) when the email cannot be sent', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(user);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser());
    (passwordResetDao.putAndReturnId as jest.Mock).mockResolvedValue('reset-1');
    (sendEmail as jest.Mock).mockRejectedValue(new Error('ses down'));

    const { rawRequest } = await send('alice@example.com');
    await new Promise((resolve) => setImmediate(resolve));

    expect(rawRequest.flash).toHaveBeenCalledWith('success', LOST_PASSWORD_SENT);
    expect(rawRequest.logger.error).toHaveBeenCalled();
  });
});

describe('login', () => {
  it('keys the per-account limiter on address and lowercased username', () => {
    const req: any = { ip: '203.0.113.9', headers: {}, body: { username: 'Alice' } };
    expect(loginAccountKey(req)).toBe('203.0.113.9:alice');
    expect(emailRequestKey({ ...req, body: { email: 'Alice@Example.com' } })).toBe('203.0.113.9:alice@example.com');
  });

  it('asks for both fields without touching the strategy', async () => {
    const flash = jest.fn();
    await (loginHandler as any)({ body: { username: 'alice' }, flash, headers: {} }, {}, jest.fn());

    expect(passport.authenticate).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/username or email address and your password/));
  });
});
