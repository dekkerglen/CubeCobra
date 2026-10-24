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

import { loginAccountKey, postHandler as loginHandler } from '../../src/router/routes/user/login';
import { emailRequestKey } from '../../src/router/routes/user/lostpassword';

beforeEach(() => {
  jest.clearAllMocks();
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
