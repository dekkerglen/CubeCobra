import bcrypt from 'bcryptjs';

jest.mock('../../src/dynamo/daos', () => ({
  userDao: {
    getByIdWithSensitiveData: jest.fn(),
    getByEmail: jest.fn(),
    update: jest.fn(),
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

import { userDao } from '../../src/dynamo/daos';
import { handler as confirmHandler } from '../../src/router/routes/user/confirmemailchange';
import { EMAIL_CHANGE_TTL_MS, EMAIL_PAGE, handler as updateHandler } from '../../src/router/routes/user/updateemail';
import sendEmail from '../../src/serverutils/email';
import { redirect } from '../../src/serverutils/render';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const PASSWORD = 'current password';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

const user = createUser({ id: 'user-1', username: 'alice' });

const storedUser = (overrides: Record<string, any> = {}) => ({
  ...user,
  email: 'old@example.com',
  passwordHash: PASSWORD_HASH,
  emailVerified: true,
  sessionVersion: 1,
  ...overrides,
});

const redirectedTo = () => {
  const calls = (redirect as jest.Mock).mock.calls;
  return calls[calls.length - 1]?.[2];
};

describe('POST /user/updateemail', () => {
  let flash: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    flash = jest.fn();
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(storedUser());
    (userDao.getByEmail as jest.Mock).mockResolvedValue(null);
  });

  const submit = (body: Record<string, any>) =>
    call(updateHandler).as(user).withFlash(flash).withRequest({ validated: true, body }).send();

  it('requires the current password', async () => {
    await submit({ email: 'new@example.com', password: 'wrong password' });

    expect(flash).toHaveBeenCalledWith('danger', 'Password is incorrect.');
    expect(userDao.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(redirectedTo()).toBe(EMAIL_PAGE);
  });

  it('refuses an address already used by another account', async () => {
    (userDao.getByEmail as jest.Mock).mockResolvedValue(createUser({ id: 'user-2' }));

    await submit({ email: 'taken@example.com', password: PASSWORD });

    expect(flash).toHaveBeenCalledWith('danger', 'That email address is already in use by another account.');
    expect(userDao.update).not.toHaveBeenCalled();
  });

  it('refuses addresses the site does not accept', async () => {
    await submit({ email: 'new+tag@example.com', password: PASSWORD });

    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/plus email addressing/));
    expect(userDao.update).not.toHaveBeenCalled();
  });

  it('does nothing when the form failed validation', async () => {
    await call(updateHandler)
      .as(user)
      .withFlash(flash)
      .withRequest({ validated: false, body: { email: 'nope' } })
      .send();

    expect(userDao.getByIdWithSensitiveData).not.toHaveBeenCalled();
    expect(redirectedTo()).toBe(EMAIL_PAGE);
  });

  it('holds the new address as pending and emails both addresses, without changing the email', async () => {
    const before = Date.now();
    await submit({ email: 'New@Example.com', password: PASSWORD });

    const updated = (userDao.update as jest.Mock).mock.calls[0][0];
    expect(updated.email).toBe('old@example.com');
    expect(updated.pendingEmail).toBe('new@example.com');
    expect(updated.pendingEmailToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(updated.pendingEmailExpires).toBeGreaterThanOrEqual(before + EMAIL_CHANGE_TTL_MS);

    expect(sendEmail).toHaveBeenCalledWith('new@example.com', expect.any(String), 'confirm_email_change', {
      id: 'user-1',
      token: updated.pendingEmailToken,
      username: 'alice',
    });
    expect(sendEmail).toHaveBeenCalledWith('old@example.com', expect.any(String), 'email_change_notice', {
      username: 'alice',
    });
    expect(flash).toHaveBeenCalledWith('success', expect.stringContaining('new@example.com'));
    expect(redirectedTo()).toBe(EMAIL_PAGE);
  });
});

describe('GET /user/confirmemailchange/:id/:token', () => {
  const TOKEN = 'a'.repeat(43);
  let flash: jest.Mock;
  let login: jest.Mock;

  const pending = (overrides: Record<string, any> = {}) =>
    storedUser({
      pendingEmail: 'new@example.com',
      pendingEmailToken: TOKEN,
      pendingEmailExpires: Date.now() + 60_000,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    flash = jest.fn();
    login = jest.fn((_user, _options, cb) => cb());
    (userDao.getByEmail as jest.Mock).mockResolvedValue(null);
  });

  const open = (params: Record<string, string>, signedIn = true) =>
    call(confirmHandler)
      .withFlash(flash)
      .withRequest({ params, login, ...(signedIn ? { user } : {}) } as any)
      .send();

  it('swaps in the new address, clears the pending change and signs out other sessions', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(pending());

    await open({ id: 'user-1', token: TOKEN });

    expect(userDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        emailVerified: true,
        pendingEmail: '',
        pendingEmailToken: '',
        pendingEmailExpires: 0,
        sessionVersion: 2,
      }),
    );
    // The browser that confirmed stays signed in at the new version.
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', sessionVersion: 2 }),
      expect.anything(),
      expect.any(Function),
    );
    expect(flash).toHaveBeenCalledWith('success', expect.stringMatching(/updated/));
    expect(redirectedTo()).toBe(EMAIL_PAGE);
  });

  it('works from a browser that is not signed in, and asks the user to log in again', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(pending());

    await open({ id: 'user-1', token: TOKEN }, false);

    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
    expect(login).not.toHaveBeenCalled();
    expect(redirectedTo()).toBe('/user/login');
  });

  it.each([
    ['a wrong token', { id: 'user-1', token: 'b'.repeat(43) }, {}],
    ['an expired link', { id: 'user-1', token: TOKEN }, { pendingEmailExpires: Date.now() - 1 }],
    ['no pending change', { id: 'user-1', token: TOKEN }, { pendingEmail: undefined, pendingEmailToken: undefined }],
  ])('rejects %s', async (_label, params, overrides) => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(pending(overrides));

    await open(params);

    expect(userDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/invalid or has expired/));
  });

  it('rejects an unknown user', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(undefined);

    await open({ id: 'nobody', token: TOKEN }, false);

    expect(userDao.update).not.toHaveBeenCalled();
    expect(redirectedTo()).toBe('/user/login');
  });

  it('does not take an address another account claimed in the meantime', async () => {
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue(pending());
    (userDao.getByEmail as jest.Mock).mockResolvedValue(createUser({ id: 'user-2' }));

    await open({ id: 'user-1', token: TOKEN });

    const updated = (userDao.update as jest.Mock).mock.calls[0][0];
    expect(updated.email).toBe('old@example.com');
    expect(updated.pendingEmail).toBe('');
    expect(updated.sessionVersion).toBe(1);
    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/another account/));
  });
});
