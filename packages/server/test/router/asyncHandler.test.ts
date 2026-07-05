import { asyncHandler, wrapHandlers } from '../../src/router/asyncHandler';

const req = {} as any;
const res = {} as any;

describe('asyncHandler', () => {
  it('forwards a rejected promise to next(err)', async () => {
    const err = new Error('async boom');
    const next = jest.fn();
    await asyncHandler(async () => {
      throw err;
    })(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('forwards a synchronous throw to next(err)', async () => {
    const err = new Error('sync boom');
    const next = jest.fn();
    await asyncHandler((() => {
      throw err;
    }) as any)(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('does not call next when the handler succeeds and responds itself', async () => {
    const next = jest.fn();
    await asyncHandler(async () => {
      // terminal handler: responds, does not call next
    })(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes req/res/next through to the wrapped handler', async () => {
    const fn = jest.fn();
    const next = jest.fn();
    await asyncHandler(fn)(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
  });
});

describe('wrapHandlers', () => {
  it('wraps a single handler into an array', () => {
    const wrapped = wrapHandlers((() => undefined) as any);
    expect(wrapped).toHaveLength(1);
  });

  it('wraps every handler in an array', () => {
    const wrapped = wrapHandlers([(() => undefined) as any, (() => undefined) as any]);
    expect(wrapped).toHaveLength(2);
  });

  it('each wrapped handler forwards errors to next(err)', async () => {
    const err = new Error('boom');
    const [wrapped] = wrapHandlers(async () => {
      throw err;
    });
    const next = jest.fn();
    await wrapped!(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
