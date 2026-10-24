import { cachePromise } from 'serverutils/cubefn';

jest.mock('serverutils/carddb');
jest.mock('serverutils/ml', () => ({ batchDraft: jest.fn() }));

// The cache is module state shared by every test here, so each test uses its own key prefix.
describe('cachePromise', () => {
  it('reuses the cached promise for the same key', async () => {
    const callback = jest.fn(async () => 'value');

    await expect(cachePromise('same/a', callback)).resolves.toBe('value');
    await expect(cachePromise('same/a', callback)).resolves.toBe('value');

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('drops a rejected promise so the next call retries', async () => {
    const failing = jest.fn(async () => {
      throw new Error('boom');
    });
    const succeeding = jest.fn(async () => 'ok');

    await expect(cachePromise('retry/a', failing)).rejects.toThrow('boom');
    await expect(cachePromise('retry/a', succeeding)).resolves.toBe('ok');

    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it('evicts the least recently used entries instead of failing when many keys are added', async () => {
    const first = jest.fn(async () => 'first');
    await cachePromise('many/0', first);

    // Far more distinct keys than the cache holds (the old cache threw ECACHEFULL here).
    for (let i = 1; i <= 5000; i++) {
      await expect(cachePromise(`many/${i}`, async () => i)).resolves.toBe(i);
    }

    await cachePromise('many/0', first);
    expect(first).toHaveBeenCalledTimes(2);
  });

  it('evicts old entries once cached buffers exceed the byte budget', async () => {
    const chunk = 50 * 1024 * 1024;
    const firstBuffer = jest.fn(async () => Buffer.allocUnsafe(chunk));
    const recent = jest.fn(async () => Buffer.allocUnsafe(chunk));

    await cachePromise('bytes/0', firstBuffer);
    await cachePromise('bytes/1', async () => Buffer.allocUnsafe(chunk));
    await cachePromise('bytes/2', recent);

    // 150 MB is over budget, so the oldest buffer went; the newest is still cached.
    await cachePromise('bytes/2', recent);
    await cachePromise('bytes/0', firstBuffer);
    expect(recent).toHaveBeenCalledTimes(1);
    expect(firstBuffer).toHaveBeenCalledTimes(2);
  });
});
