export interface IndefinitePaginationFetchArgs<T> {
  callApi: (route: RequestInfo, body: any) => Promise<Response>;
  fetchMoreRoute: string;
  items: T[];
  setItems: (items: T[]) => void;
  lastKey: any;
  setLastKey: (lastKey: any) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  itemsKey?: string;
  setLoading: (loading: boolean) => void;
}

export const getIndefinitePageCount = <T>(items: T[], pageSize: number) => Math.ceil(items.length / pageSize);

export const hasIndefiniteMore = (lastKey: any) => !!lastKey;

export const fetchIndefiniteMoreData = async <T>({
  callApi,
  fetchMoreRoute,
  items,
  setItems,
  lastKey,
  setLastKey,
  page,
  setPage,
  pageSize,
  itemsKey = 'items',
  setLoading,
}: IndefinitePaginationFetchArgs<T>) => {
  setLoading(true);

  try {
    const response = await callApi(fetchMoreRoute, {
      lastKey,
    });

    if (response.ok) {
      const json = await response.json();

      // eslint-disable-next-line no-restricted-syntax
      if (json.success === 'true' || itemsKey in json) {
        const responseItems = json[itemsKey];
        const newItems = [...items, ...responseItems];
        setItems(newItems);

        const numItemsShowOnLastPage = items.length % pageSize;
        //If current page is full and we just fetched more items, then move to next page
        if (numItemsShowOnLastPage === 0 && responseItems.length > 0) {
          setPage(page + 1);
        }
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
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
  fetchMoreData: () => Promise<void>;
}) => {
  if (newPage >= pageCount) {
    await fetchMoreData();
    return;
  }

  setPage(newPage);
};
