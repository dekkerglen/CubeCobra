jest.mock('dotenv/config', () => ({}));
jest.mock('serverutils/cloudwatch', () => ({ info: jest.fn() }));

// jest.setup.ts mocks serverutils/ml globally; this test needs the real client.
const { encode } = jest.requireActual('serverutils/ml');

describe('ML client shared secret', () => {
  const originalSecret = process.env.RECOMMENDER_SHARED_SECRET;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ success: true, encoding: [1, 2] }), { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalSecret === undefined) {
      delete process.env.RECOMMENDER_SHARED_SECRET;
    } else {
      process.env.RECOMMENDER_SHARED_SECRET = originalSecret;
    }
  });

  it('sends X-Internal-Token when RECOMMENDER_SHARED_SECRET is set', async () => {
    process.env.RECOMMENDER_SHARED_SECRET = 'shh';

    await expect(encode(['a'])).resolves.toEqual([1, 2]);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-Internal-Token': 'shh' });
  });

  it('sends no token header when the secret is not configured', async () => {
    delete process.env.RECOMMENDER_SHARED_SECRET;

    await encode(['a']);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
