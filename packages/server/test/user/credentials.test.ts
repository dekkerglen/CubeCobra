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

import express from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import request from 'supertest';

import { LOGIN_FAILED_MESSAGE } from '../../src/config/passport';
import { passwordResetDao, userDao } from '../../src/dynamo/daos';
import { loginAccountKey, loginLimiterOptions, postHandler as loginHandler } from '../../src/router/routes/user/login';
import {
  emailRequestKey,
  LOST_PASSWORD_SENT,
  postHandler as lostPasswordHandler,
} from '../../src/router/routes/user/lostpassword';
import {
  getHandler as resetPageHandler,
  postHandler as resetHandler,
  routes as passwordResetRoutes,
} from '../../src/router/routes/user/passwordreset';
import { confirmHandler } from '../../src/router/routes/user/register';
import { postHandler as resendHandler, VERIFICATION_SENT } from '../../src/router/routes/user/resendverification';
import {
  handler as changePasswordHandler,
  routes as changePasswordRoutes,
} from '../../src/router/routes/user/resetpassword';
import sendEmail from '../../src/serverutils/email';
import * as passwordPolicy from '../../src/serverutils/passwordPolicy';
import { redirect, render } from '../../src/serverutils/render';
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

const redirectedTo = () => {
  const calls = (redirect as jest.Mock).mock.calls;
  return calls[calls.length - 1]?.[2];
};

// Runs a list of express-validator chains (and flashValidationErrors) against a request body
// and returns the flashed messages.
const validate = async (handlers: any[], body: Record<string, any>) => {
  const flash = jest.fn();
  const req: any = { body, flash };
  for (const handler of handlers.flat()) {
    if (typeof handler.run === 'function') {
      await handler.run(req);
    } else if (handler.name === 'flashValidationErrors') {
      handler(req, {}, () => undefined);
    }
  }
  return { validated: req.validated, messages: flash.mock.calls.map((args) => args[1]) };
};

const postHandlers = (routes: any[]) => routes.find((route) => route.method === 'post').handler;

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

  it('gives the same answer whether or not the account exists', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(null);
    const unknown = await send('nobody@example.com');

    expect(passwordResetDao.putAndReturnId).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(unknown.rawRequest.flash).toHaveBeenCalledWith('success', LOST_PASSWORD_SENT);
    expect(redirectedTo()).toBe('/user/lostpassword');
  });

  it('ties the reset link to the current session version', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(user);
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ sessionVersion: 4 }));
    (passwordResetDao.putAndReturnId as jest.Mock).mockResolvedValue('reset-1');
    (sendEmail as jest.Mock).mockResolvedValue(undefined);

    const known = await send('alice@example.com');

    expect(passwordResetDao.putAndReturnId).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'user-1', sessionVersion: 4 }),
    );
    expect(sendEmail).toHaveBeenCalledWith('alice@example.com', 'Password Reset', 'password_reset', { id: 'reset-1' });
    expect(known.rawRequest.flash).toHaveBeenCalledWith('success', LOST_PASSWORD_SENT);
  });

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

describe('password reset link', () => {
  const NEW_PASSWORD = 'brand new password';
  const reset = (overrides: Record<string, any> = {}) => ({
    id: 'reset-1',
    owner: 'user-1',
    date: Date.now(),
    sessionVersion: 2,
    ...overrides,
  });

  const submit = (signedIn = false) =>
    call(resetHandler)
      .withFlash(jest.fn())
      .withRequest({
        validated: true,
        body: { code: 'reset-1', password: NEW_PASSWORD, password2: NEW_PASSWORD },
        login: jest.fn((_user, _options, cb) => cb()),
        ...(signedIn ? { user } : {}),
      } as any)
      .send();

  it('sets the password, signs out every session and retires other links', async () => {
    (passwordResetDao.getById as jest.Mock).mockResolvedValue(reset());
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(
      storedUser({ sessionVersion: 2, pendingEmail: 'attacker@example.com', pendingEmailToken: 't' }),
    );

    await submit();

    const updated = (userDao.update as jest.Mock).mock.calls[0][0];
    expect(await bcrypt.compare(NEW_PASSWORD, updated.passwordHash)).toBe(true);
    expect(updated.sessionVersion).toBe(3);
    expect(updated.pendingEmail).toBe('');
    expect(updated.pendingEmailToken).toBe('');
    expect(passwordResetDao.deleteById).toHaveBeenCalledWith('reset-1');
    expect(redirectedTo()).toBe('/user/login');
  });

  it('keeps the acting session signed in when the owner resets while logged in', async () => {
    (passwordResetDao.getById as jest.Mock).mockResolvedValue(reset());
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ sessionVersion: 2 }));

    const { rawRequest } = await submit(true);

    expect((rawRequest as any).login).toHaveBeenCalledWith(
      expect.objectContaining({ sessionVersion: 3 }),
      expect.anything(),
      expect.any(Function),
    );
  });

  it('refuses a link issued before a later password or email change', async () => {
    (passwordResetDao.getById as jest.Mock).mockResolvedValue(reset({ sessionVersion: 1 }));
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ sessionVersion: 2 }));

    await submit();

    expect(userDao.update).not.toHaveBeenCalled();
    expect(passwordResetDao.deleteById).toHaveBeenCalledWith('reset-1');
    expect(redirectedTo()).toBe('/user/lostpassword');
  });

  it('treats links from before versioning as version 0', async () => {
    (passwordResetDao.getById as jest.Mock).mockResolvedValue(reset({ sessionVersion: undefined }));
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser());

    await submit();

    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 1 }));
  });

  it('does not show the reset form for a superseded link', async () => {
    (passwordResetDao.getById as jest.Mock).mockResolvedValue(reset({ sessionVersion: 1 }));
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ sessionVersion: 2 }));

    await call(resetPageHandler).withFlash(jest.fn()).withParams({ id: 'reset-1' }).send();

    expect(render).not.toHaveBeenCalled();
    expect(redirectedTo()).toBe('/');
  });

  it('shows the reset form for a current link', async () => {
    (passwordResetDao.getById as jest.Mock).mockResolvedValue(reset());
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ sessionVersion: 2 }));

    await call(resetPageHandler).withFlash(jest.fn()).withParams({ id: 'reset-1' }).send();

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'PasswordResetPage',
      { code: 'reset-1' },
      { title: 'Reset Password' },
    );
  });

  it('applies the shared password policy', async () => {
    const handlers = postHandlers(passwordResetRoutes);

    expect((await validate(handlers, { password: 'short', password2: 'short' })).validated).toBe(false);
    expect((await validate(handlers, { password: 'a'.repeat(73), password2: 'a'.repeat(73) })).validated).toBe(false);
    expect((await validate(handlers, { password: 'a'.repeat(40), password2: 'a'.repeat(40) })).validated).toBe(true);
  });
});

describe('change password (signed in)', () => {
  const NEW_PASSWORD = 'brand new password';

  const submit = (body: Record<string, any>) =>
    call(changePasswordHandler)
      .as(user)
      .withFlash(jest.fn())
      .withRequest({ validated: true, body, login: jest.fn((_user, _options, cb) => cb()) } as any)
      .send();

  it('checks the current password', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser());

    const { rawRequest } = await submit({ password: 'wrong', password2: NEW_PASSWORD, password3: NEW_PASSWORD });

    expect(userDao.update).not.toHaveBeenCalled();
    expect(rawRequest.flash).toHaveBeenCalledWith('danger', 'Password is incorrect');
  });

  it('sets the new password, signs out other sessions and keeps this one', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser({ sessionVersion: 5 }));

    const { rawRequest } = await submit({ password: PASSWORD, password2: NEW_PASSWORD, password3: NEW_PASSWORD });

    const updated = (userDao.update as jest.Mock).mock.calls[0][0];
    expect(await bcrypt.compare(NEW_PASSWORD, updated.passwordHash)).toBe(true);
    expect(updated.sessionVersion).toBe(6);
    expect((rawRequest as any).login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', sessionVersion: 6 }),
      expect.anything(),
      expect.any(Function),
    );
    expect(rawRequest.flash).toHaveBeenCalledWith('success', 'Password updated successfully');
  });

  it('responds (instead of hanging) when hashing fails', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser());
    const spy = jest.spyOn(passwordPolicy, 'hashPassword').mockRejectedValue(new Error('boom'));

    await submit({ password: PASSWORD, password2: NEW_PASSWORD, password3: NEW_PASSWORD });

    const { handleRouteError } = jest.requireMock('serverutils/render');
    expect(handleRouteError).toHaveBeenCalled();
    expect(userDao.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('validates the new password, not the current one', async () => {
    const handlers = postHandlers(changePasswordRoutes);
    const longCurrent = 'x'.repeat(200);

    // A long legacy password can still be changed...
    expect(
      (await validate(handlers, { password: longCurrent, password2: NEW_PASSWORD, password3: NEW_PASSWORD })).validated,
    ).toBe(true);
    // ...but the new one has to meet the policy and be confirmed.
    expect((await validate(handlers, { password: PASSWORD, password2: '', password3: '' })).validated).toBe(false);
    expect((await validate(handlers, { password: PASSWORD, password2: 'x', password3: 'x' })).validated).toBe(false);
    expect(
      (await validate(handlers, { password: PASSWORD, password2: NEW_PASSWORD, password3: 'something else' })).messages,
    ).toContain("New passwords don't match");
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

  it('flashes the strategy message as danger on failure', async () => {
    (passport.authenticate as jest.Mock).mockImplementation(
      (_name: string, cb: any) => () => cb(null, false, { message: LOGIN_FAILED_MESSAGE }),
    );
    const flash = jest.fn();
    const req: any = { body: { username: 'alice', password: 'nope' }, flash, headers: {}, header: () => undefined };

    await (loginHandler as any)(req, {}, jest.fn());

    expect(flash).toHaveBeenCalledWith('danger', LOGIN_FAILED_MESSAGE);
    expect(redirectedTo()).toBe('/user/login');
  });

  it('logs in and redirects on success', async () => {
    const authenticated = { ...user, sessionVersion: 0 };
    (passport.authenticate as jest.Mock).mockImplementation((_name: string, cb: any) => () => cb(null, authenticated));
    const login = jest.fn((_user, cb) => cb());
    const req: any = {
      body: { username: 'alice', password: PASSWORD },
      flash: jest.fn(),
      headers: {},
      header: () => undefined,
      login,
    };

    const res: any = { locals: {} };

    await (loginHandler as any)(req, res, jest.fn());

    expect(login).toHaveBeenCalledWith(authenticated, expect.any(Function));
    expect(res.locals.loginSucceeded).toBe(true);
    expect(redirectedTo()).toBe('/');
  });

  it('counts only failed attempts toward the login limits', async () => {
    const app = express();
    app.use(rateLimit({ windowMs: 60_000, limit: 2, ...loginLimiterOptions }));
    app.post('/succeed', (_req, res) => {
      res.locals.loginSucceeded = true;
      res.sendStatus(204);
    });
    app.post('/fail', (_req, res) => {
      res.sendStatus(204);
    });

    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).post('/succeed')).status).toBe(204);
    }
    expect((await request(app).post('/fail')).status).toBe(204);
    expect((await request(app).post('/fail')).status).toBe(204);
    expect((await request(app).post('/fail')).status).toBe(429);
  });
});
