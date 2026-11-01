import {
  clampPage,
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from '../../src/utils/indefinitePagination';

type TestItem = { id: number };

const jsonResponse = (body: any): Response => ({ ok: true, json: async () => body }) as unknown as Response;

let nextItemId = 0;

const makeItems = (count: number): TestItem[] => Array.from({ length: count }, () => ({ id: nextItemId++ }));

interface HarnessOptions {
  itemsPerResponse: number;
  lastKeys: any[];
  pageSize: number;
  targetPage: number;
  initialItems?: TestItem[];
  initialLastKey?: any;
  countRows?: (items: TestItem[]) => number;
  maxFetches?: number;
  body?: Record<string, unknown>;
  itemsKey?: string;
}

const runFetch = async ({
  itemsPerResponse,
  lastKeys,
  pageSize,
  targetPage,
  initialItems = [],
  initialLastKey = 'start-key',
  countRows,
  maxFetches,
  body,
  itemsKey = 'items',
}: HarnessOptions) => {
  let call = 0;
  const callApi = jest.fn(async () => {
    // Responses past the end of lastKeys repeat the final entry, so a test only
    // has to spell out the keys it cares about.
    const lastKey = lastKeys[Math.min(call, lastKeys.length - 1)];
    call += 1;
    return jsonResponse({ [itemsKey]: makeItems(itemsPerResponse), lastKey });
  });

  const setItems = jest.fn();
  const setLastKey = jest.fn();
  const setPage = jest.fn();
  const setLoading = jest.fn();

  await fetchIndefiniteMoreData<TestItem>({
    callApi,
    fetchMoreRoute: '/test/route',
    items: initialItems,
    setItems,
    lastKey: initialLastKey,
    setLastKey,
    setPage,
    pageSize,
    itemsKey,
    setLoading,
    targetPage,
    countRows,
    maxFetches,
    body,
  });

  return { callApi, setItems, setLastKey, setPage, setLoading };
};

beforeEach(() => {
  nextItemId = 0;
});

describe('getIndefinitePageCount', () => {
  it('counts partial pages', () => {
    expect(getIndefinitePageCount(makeItems(37), 36)).toBe(2);
    expect(getIndefinitePageCount([], 36)).toBe(0);
  });
});

describe('hasIndefiniteMore', () => {
  it('is true only for a truthy cursor', () => {
    expect(hasIndefiniteMore('key')).toBe(true);
    expect(hasIndefiniteMore(null)).toBe(false);
  });
});

describe('clampPage', () => {
  it('returns 0 when there are no pages', () => {
    expect(clampPage(5, 0)).toBe(0);
  });

  it('clamps past the end', () => {
    expect(clampPage(5, 2)).toBe(1);
  });

  it('passes a valid page through', () => {
    expect(clampPage(1, 3)).toBe(1);
  });
});

describe('fetchIndefiniteMoreData', () => {
  it('keeps fetching until the requested page window is full', async () => {
    const { callApi, setItems, setPage } = await runFetch({
      itemsPerResponse: 10,
      lastKeys: ['k1', 'k2', 'k3', 'k4'],
      pageSize: 36,
      targetPage: 0,
    });

    expect(callApi).toHaveBeenCalledTimes(4);
    expect(setItems).toHaveBeenCalledTimes(1);
    expect(setItems.mock.calls[0][0]).toHaveLength(40);
    expect(setPage).toHaveBeenCalledWith(0);
  });

  it('stops when the cursor is exhausted even if the window is short', async () => {
    const { callApi, setItems, setPage, setLastKey } = await runFetch({
      itemsPerResponse: 5,
      lastKeys: [null],
      pageSize: 36,
      targetPage: 0,
    });

    expect(callApi).toHaveBeenCalledTimes(1);
    expect(setItems.mock.calls[0][0]).toHaveLength(5);
    expect(setLastKey).toHaveBeenCalledWith(null);
    expect(setPage).toHaveBeenCalledWith(0);
  });

  it('stops when a response makes no progress despite returning a lastKey', async () => {
    const { callApi, setItems, setLastKey } = await runFetch({
      itemsPerResponse: 0,
      lastKeys: ['never-ending'],
      pageSize: 36,
      targetPage: 0,
    });

    expect(callApi).toHaveBeenCalledTimes(1);
    expect(setItems.mock.calls[0][0]).toHaveLength(0);
    expect(setLastKey).toHaveBeenCalledWith('never-ending');
  });

  it('stops at maxFetches', async () => {
    const { callApi, setItems } = await runFetch({
      itemsPerResponse: 1,
      lastKeys: ['k'],
      pageSize: 36,
      targetPage: 0,
      maxFetches: 5,
    });

    expect(callApi).toHaveBeenCalledTimes(5);
    expect(setItems.mock.calls[0][0]).toHaveLength(5);
  });

  it('counts display rows, not raw items, when countRows is supplied', async () => {
    const { callApi, setItems, setPage } = await runFetch({
      itemsPerResponse: 4,
      lastKeys: ['k'],
      pageSize: 2,
      targetPage: 0,
      countRows: () => 1,
    });

    expect(callApi).toHaveBeenCalledTimes(5);
    expect(setItems.mock.calls[0][0]).toHaveLength(20);
    expect(setPage).toHaveBeenCalledWith(0);
  });

  it('clamps the advance to the last page that actually has rows', async () => {
    const { setPage } = await runFetch({
      itemsPerResponse: 5,
      lastKeys: [null],
      pageSize: 36,
      targetPage: 3,
    });

    expect(setPage).toHaveBeenCalledWith(0);
    expect(setPage).not.toHaveBeenCalledWith(3);
  });

  it('sends extra body fields on every fetch', async () => {
    const { callApi } = await runFetch({
      itemsPerResponse: 10,
      lastKeys: ['k1', 'k2'],
      pageSize: 20,
      targetPage: 0,
      body: { query: 'abc', order: 'pop' },
    });

    expect(callApi).toHaveBeenCalledTimes(2);
    expect(callApi).toHaveBeenNthCalledWith(1, '/test/route', {
      lastKey: 'start-key',
      query: 'abc',
      order: 'pop',
    });
    expect(callApi).toHaveBeenNthCalledWith(2, '/test/route', { lastKey: 'k1', query: 'abc', order: 'pop' });
  });

  // A caller whose body happens to carry a lastKey would otherwise overwrite the cursor, freezing
  // pagination on whatever stale key the caller handed in.
  it('keeps its own cursor when the extra body carries a lastKey', async () => {
    const { callApi } = await runFetch({
      itemsPerResponse: 10,
      lastKeys: ['k1', 'k2'],
      pageSize: 20,
      targetPage: 0,
      body: { query: 'abc', lastKey: 'caller-key' },
    });

    expect(callApi).toHaveBeenNthCalledWith(1, '/test/route', { lastKey: 'start-key', query: 'abc' });
    expect(callApi).toHaveBeenNthCalledWith(2, '/test/route', { lastKey: 'k1', query: 'abc' });
  });

  it('preserves the lastKey from the final response', async () => {
    const { setLastKey } = await runFetch({
      itemsPerResponse: 10,
      lastKeys: ['k1', 'k2', 'final-key'],
      pageSize: 30,
      targetPage: 0,
    });

    expect(setLastKey).toHaveBeenCalledTimes(1);
    expect(setLastKey).toHaveBeenCalledWith('final-key');
  });

  it('appends to the items it was given and always clears loading', async () => {
    const existing = makeItems(3);
    const { setItems, setLoading } = await runFetch({
      itemsPerResponse: 2,
      lastKeys: [null],
      pageSize: 36,
      targetPage: 0,
      initialItems: existing,
    });

    expect(setItems.mock.calls[0][0]).toHaveLength(5);
    expect(setItems.mock.calls[0][0].slice(0, 3)).toEqual(existing);
    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it('stops without committing bad state when the response is not ok', async () => {
    const callApi = jest.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response);
    const setItems = jest.fn();
    const setLastKey = jest.fn();
    const setPage = jest.fn();
    const setLoading = jest.fn();

    await fetchIndefiniteMoreData<TestItem>({
      callApi,
      fetchMoreRoute: '/test/route',
      items: makeItems(2),
      setItems,
      lastKey: 'start-key',
      setLastKey,
      setPage,
      pageSize: 36,
      setLoading,
      targetPage: 0,
    });

    expect(callApi).toHaveBeenCalledTimes(1);
    expect(setItems.mock.calls[0][0]).toHaveLength(2);
    expect(setLastKey).toHaveBeenCalledWith('start-key');
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });
});

describe('handleIndefinitePageSelection', () => {
  it('passes the requested page to the fetcher when it is not loaded yet', async () => {
    const fetchMoreData = jest.fn(async () => {});
    const setPage = jest.fn();

    await handleIndefinitePageSelection({ newPage: 4, pageCount: 2, setPage, fetchMoreData });

    expect(fetchMoreData).toHaveBeenCalledWith(4);
    expect(setPage).not.toHaveBeenCalled();
  });

  it('selects an already loaded page without fetching', async () => {
    const fetchMoreData = jest.fn(async () => {});
    const setPage = jest.fn();

    await handleIndefinitePageSelection({ newPage: 1, pageCount: 3, setPage, fetchMoreData });

    expect(setPage).toHaveBeenCalledWith(1);
    expect(fetchMoreData).not.toHaveBeenCalled();
  });
});
