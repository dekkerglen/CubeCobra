import { requireInternalToken, tokenMatches } from '../src/internalAuth';

const run = (secret: string | (string | undefined)[] | undefined, header?: string) => {
  const middleware = requireInternalToken(secret);
  const req = { get: (name: string) => (name.toLowerCase() === 'x-internal-token' ? header : undefined) } as any;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const next = jest.fn();
  middleware(req, res as any, next);
  return { res, next };
};

describe('requireInternalToken', () => {
  it('lets every request through when no secret is configured', () => {
    expect(run(undefined).next).toHaveBeenCalled();
    expect(run('', 'anything').next).toHaveBeenCalled();
  });

  it('accepts the matching token', () => {
    const { next, res } = run('s3cret-value', 's3cret-value');
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it.each([undefined, '', 's3cret-valuX', 's3cret-value-longer', 'short'])(
    'rejects a missing or wrong token (%s)',
    (header) => {
      const { next, res } = run('s3cret-value', header);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
    },
  );
});

describe('tokenMatches', () => {
  it('compares tokens of any length without throwing', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abcd', 'abc')).toBe(false);
    expect(tokenMatches(['abc'], 'abc')).toBe(false);
    expect(tokenMatches(undefined, 'abc')).toBe(false);
  });

  it('accepts the previous secret during a rotation, and only the configured ones', () => {
    expect(run(['new-secret', 'old-secret'], 'old-secret').next).toHaveBeenCalled();
    expect(run(['new-secret', 'old-secret'], 'new-secret').next).toHaveBeenCalled();
    expect(run(['new-secret', undefined], 'old-secret').res.statusCode).toBe(401);
  });

  it('stays open when neither the secret nor the previous one is set', () => {
    expect(run([undefined, undefined], undefined).next).toHaveBeenCalled();
  });
});
