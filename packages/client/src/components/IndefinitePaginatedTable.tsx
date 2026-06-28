import React, { useCallback, useContext, useMemo, useState } from 'react';

import { CSRFContext } from '../contexts/CSRFContext';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from '../utils/indefinitePagination';
import { Card, CardBody, CardHeader } from './base/Card';
import { Flexbox } from './base/Layout';
import Pagination from './base/Pagination';
import Table from './base/Table';
import Text from './base/Text';

interface IndefinitePaginatedTableProps<T> {
  items?: T[];
  setItems: (items: T[]) => void;
  fetchMoreRoute: string;
  renderItem: (item: T) => { [key: string]: React.ReactNode };
  lastKey: any;
  setLastKey: (lastKey: any) => void;
  pageSize: number;
  noneMessage?: string;
  itemsKey?: string;
  header: string;
  headers: string[];
  inCard?: boolean;
}

const IndefinitePaginatedTable = <T,>({
  items,
  setItems,
  fetchMoreRoute,
  renderItem,
  lastKey,
  setLastKey,
  header,
  pageSize,
  noneMessage = 'No items found.',
  itemsKey = 'items',
  headers,
  inCard = false,
}: IndefinitePaginatedTableProps<T>) => {
  const { callApi } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const safeItems = useMemo(() => items ?? [], [items]);
  const pageCount = getIndefinitePageCount(safeItems, pageSize);
  const hasMore = hasIndefiniteMore(lastKey);

  const fetchMoreData = useCallback(async () => {
    await fetchIndefiniteMoreData<T>({
      callApi,
      fetchMoreRoute,
      items: safeItems,
      setItems,
      lastKey,
      setLastKey,
      page,
      setPage,
      pageSize,
      itemsKey,
      setLoading,
    });
  }, [callApi, fetchMoreRoute, safeItems, setItems, lastKey, setLastKey, page, setPage, pageSize, itemsKey]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData,
        });
      }}
      loading={loading}
    />
  );

  const body =
    safeItems.length > 0 ? (
      <Flexbox direction="col" gap="2">
        <Table headers={headers} rows={safeItems.slice(page * pageSize, (page + 1) * pageSize).map(renderItem)} />
        <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
          {pager}
        </Flexbox>
      </Flexbox>
    ) : (
      <Text semibold lg>
        {noneMessage}
      </Text>
    );

  if (!inCard) {
    return (
      <Flexbox direction="col" gap="2">
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            {header} ({safeItems.length}
            {hasMore ? '+' : ''})
          </Text>
          {safeItems.length > 0 && pager}
        </Flexbox>
        {body}
      </Flexbox>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            {header} ({safeItems.length}
            {hasMore ? '+' : ''})
          </Text>
          {safeItems.length > 0 && pager}
        </Flexbox>
      </CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
};

export default IndefinitePaginatedTable;
