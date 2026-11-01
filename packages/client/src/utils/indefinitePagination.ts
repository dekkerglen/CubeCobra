export interface IndefinitePaginationFetchArgs<T> {
  callApi: (route: RequestInfo, body: any) => Promise<Response>;
  fetchMoreRoute: string;
  items: T[];
  setItems: (items: T[]) => void;
  lastKey: any;
  setLastKey: (lastKey: any) => void;
  setPage: (page: number) => void;
  pageSize: number;
  itemsKey?: string;
  setLoading: (loading: boolean) => void;
  // The page the user asked for. The fetch loop runs until this page's window is
  // full, the cursor runs out, or maxFetches is reached.
  targetPage: number;
  // Number of display rows the items render as, when that differs from the raw
  // item count (grouped tables, for example). Defaults to items.length.
  countRows?: (items: T[]) => number;
  maxFetches?: number;
  // Extra fields merged into the POST body of every fetch.
  body?: Record<string, unknown>;
}

export const getIndefinitePageCount = <T>(items: T[], pageSize: number) => Math.ceil(items.length / pageSize);

export const hasIndefiniteMore = (lastKey: any) => !!lastKey;

export const clampPage = (page: number, pageCount: number) => Math.max(0, Math.min(page, pageCount - 1));

export const fetchIndefiniteMoreData = async <T>({
  callApi,
  fetchMoreRoute,
  items,
  setItems,
  lastKey,
  setLastKey,
  setPage,
  pageSize,
  itemsKey = 'items',
  setLoading,
  targetPage,
  countRows,
  maxFetches = 5,
  body,
}: IndefinitePaginationFetchArgs<T>) => {
  setLoading(true);

  // Accumulate locally and commit once at the end, so a half-filled window never
  // renders and every state write goes through the caller's setters.
  let accumulated = items;
  let cursor = lastKey;
  let fetches = 0;
  const rowsOf = (current: T[]) => (countRows ? countRows(current) : current.length);
  let rows = rowsOf(accumulated);

  try {
    while (rows < (targetPage + 1) * pageSize && hasIndefiniteMore(cursor) && fetches < maxFetches) {
      const response = await callApi(fetchMoreRoute, { lastKey: cursor, ...body });

      if (!response.ok) {
        break;
      }

      const json = await response.json();

      if (json.success !== 'true' && !(itemsKey in json)) {
        break;
      }

      const responseItems = json[itemsKey];

      if (!Array.isArray(responseItems) || responseItems.length === 0) {
        // No progress. Take the server's cursor anyway — a page whose rows were
        // all filtered out still advanced the scan, and resuming from the old
        // cursor would re-request that same empty page forever — but stop here
        // instead of looping on responses that add no rows.
        cursor = json.lastKey;
        break;
      }

      accumulated = [...accumulated, ...responseItems];
      cursor = json.lastKey;
      fetches += 1;
      rows = rowsOf(accumulated);
    }

    setItems(accumulated);
    setLastKey(cursor);
    setPage(clampPage(targetPage, Math.ceil(rows / pageSize)));
  } finally {
    setLoading(false);
  }
};

export const handleIndefinitePageSelection = async ({
  newPage,
  pageCount,
  setPage,
  fetchMoreData,
}: {
  newPage: number;
  pageCount: number;
  setPage: (page: number) => void;
  fetchMoreData: (targetPage: number) => Promise<void>;
}) => {
  if (newPage >= pageCount) {
    await fetchMoreData(newPage);
    return;
  }

  setPage(newPage);
};
