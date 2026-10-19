import bcrypt from 'bcryptjs';
import { userDao } from 'dynamo/daos';
import { handleRouteError, redirect } from 'serverutils/render';

import { handler } from '../../../src/router/routes/user/resetpassword';

jest.mock('dynamo/daos', () => ({
  userDao: {
    getByIdWithSensitiveData: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('serverutils/render', () => ({
  redirect: jest.fn(),
  handleRouteError: jest.fn(),
}));

const mockUserDao = userDao as jest.Mocked<typeof userDao>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
const mockHandleRouteError = handleRouteError as jest.MockedFunction<typeof handleRouteError>;

const ACCOUNT = '/user/account';
const PASSWORD_TAB = '/user/account?nav=password';

const buildReq = (overrides: any = {}) =>
  ({
    validated: true,
    user: { id: 'user-1' },
    body: { password: 'current', password2: 'new-password', password3: 'new-password' },
    flash: jest.fn(),
    logger: { error: jest.fn() },
    ...overrides,
  }) as any;

const res = {} as any;

describe('resetpassword handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to the account page when validation did not pass', async () => {
    const req = buildReq({ validated: false });

    await handler(req, res);

    expect(mockRedirect).toHaveBeenCalledWith(req, res, ACCOUNT);
    expect(mockUserDao.getByIdWithSensitiveData).not.toHaveBeenCalled();
  });

  it('flashes when the request has no authenticated user', async () => {
    const req = buildReq({ user: undefined });

    await handler(req, res);

    expect(req.flash).toHaveBeenCalledWith('danger', 'User not found');
    expect(mockRedirect).toHaveBeenCalledWith(req, res, PASSWORD_TAB);
  });

  it('flashes when the user record cannot be loaded', async () => {
    mockUserDao.getByIdWithSensitiveData.mockResolvedValueOnce(undefined as any);
    const req = buildReq();

    await handler(req, res);

    expect(req.flash).toHaveBeenCalledWith('danger', 'User not found');
    expect(mockUserDao.update).not.toHaveBeenCalled();
  });

  it('rejects an incorrect current password without updating', async () => {
    const passwordHash = await bcrypt.hash('the-real-password', 10);
    mockUserDao.getByIdWithSensitiveData.mockResolvedValueOnce({ id: 'user-1', passwordHash } as any);
    const req = buildReq({
      body: { password: 'wrong-password', password2: 'new-password', password3: 'new-password' },
    });

    await handler(req, res);

    expect(req.flash).toHaveBeenCalledWith('danger', 'Password is incorrect');
    expect(mockUserDao.update).not.toHaveBeenCalled();
  });

  it('rejects mismatched new passwords without updating', async () => {
    const passwordHash = await bcrypt.hash('current', 10);
    mockUserDao.getByIdWithSensitiveData.mockResolvedValueOnce({ id: 'user-1', passwordHash } as any);
    const req = buildReq({
      body: { password: 'current', password2: 'new-password', password3: 'different' },
    });

    await handler(req, res);

    expect(req.flash).toHaveBeenCalledWith('danger', "New passwords don't match");
    expect(mockUserDao.update).not.toHaveBeenCalled();
  });

  it('stores a new verifiable hash when the current password is correct', async () => {
    const passwordHash = await bcrypt.hash('current', 10);
    mockUserDao.getByIdWithSensitiveData.mockResolvedValueOnce({ id: 'user-1', passwordHash } as any);
    mockUserDao.update.mockResolvedValueOnce(undefined as any);
    const req = buildReq();

    await handler(req, res);

    expect(mockUserDao.update).toHaveBeenCalledTimes(1);
    const saved = mockUserDao.update.mock.calls[0]?.[0] as any;
    expect(saved.passwordHash).not.toEqual(passwordHash);
    await expect(bcrypt.compare('new-password', saved.passwordHash)).resolves.toBe(true);
    await expect(bcrypt.compare('current', saved.passwordHash)).resolves.toBe(false);
    expect(req.flash).toHaveBeenCalledWith('success', 'Password updated successfully');
    expect(mockRedirect).toHaveBeenCalledWith(req, res, PASSWORD_TAB);
  });

  it('routes persistence failures through handleRouteError instead of hanging', async () => {
    const passwordHash = await bcrypt.hash('current', 10);
    mockUserDao.getByIdWithSensitiveData.mockResolvedValueOnce({ id: 'user-1', passwordHash } as any);
    const failure = new Error('dynamo exploded');
    mockUserDao.update.mockRejectedValueOnce(failure);
    const req = buildReq();

    await handler(req, res);

    expect(mockHandleRouteError).toHaveBeenCalledWith(req, res, failure, PASSWORD_TAB);
    expect(req.flash).not.toHaveBeenCalledWith('success', 'Password updated successfully');
  });
});
