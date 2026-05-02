describe('loadDraftBot', () => {
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('shares the in-flight load and does not leak progress listeners', async () => {
    const encoderLoad = deferred<any>();
    const loadGraphModel = jest
      .fn()
      .mockImplementationOnce(() => encoderLoad.promise)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    jest.doMock('@tensorflow/tfjs', () => ({
      loadGraphModel,
    }));

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 0: 'oracle-a' }),
    });

    const draftBot = await import('../../src/utils/draftBot');

    const onProgressA = jest.fn();
    const onProgressB = jest.fn();

    const loadA = draftBot.loadDraftBot(onProgressA);
    const loadB = draftBot.loadDraftBot(onProgressB);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(loadGraphModel).toHaveBeenCalledTimes(1);
    expect(draftBot.getLoadProgressListenerCountForTests()).toBe(2);

    encoderLoad.resolve({});
    await Promise.all([loadA, loadB]);

    expect(loadGraphModel).toHaveBeenCalledTimes(3);
    expect(draftBot.getLoadProgressListenerCountForTests()).toBe(0);

    onProgressA.mockClear();
    await draftBot.loadDraftBot(onProgressA);
    expect(onProgressA).toHaveBeenCalledWith(100);
    expect(draftBot.getLoadProgressListenerCountForTests()).toBe(0);
  });
});
