import * as render from 'serverutils/render';

import { call } from '../test-utils/transport';

const mockCreateSession = jest.fn();

jest.mock('dotenv/config', () => ({}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({ checkout: { sessions: { create: mockCreateSession } } })),
);
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

describe('merchandise checkout', () => {
  const originalEnv = { ...process.env };
  let checkout: any;

  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.DOMAIN = 'cubecobra.example';
    process.env.HTTP_ONLY = 'false';
    jest.isolateModules(() => {
      const { routes } = require('../../src/router/routes/merchandise');
      checkout = routes.find((route: any) => route.path === '/checkout').handler[0];
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds the Stripe return URLs from the configured domain, not the Host header', async () => {
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/c/session' });

    await call(checkout)
      .withRequest({ protocol: 'http', get: () => 'evil.example', body: {} } as any)
      .send();

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://cubecobra.example/merchandise/success',
        cancel_url: 'https://cubecobra.example/merchandise/cancel',
      }),
    );
    expect(render.redirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'https://checkout.stripe.com/c/session',
    );
  });
});
