import React, { useCallback, useContext, useMemo, useState } from 'react';

import { CSRFContext } from '../contexts/CSRFContext';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from '../utils/indefinitePagination';
import { Card, CardBody, CardHeader } from './base/Card';
import CursorPagination from './base/CursorPagination';
import { Col, Flexbox, Row } from './base/Layout';
import Text from './base/Text';

interface IndefinitePaginatedListProps<T> {
  items?: T[];
  setItems: (items: T[]) => void;
  fetchMoreRoute: string;
  renderItem: (item: T) => React.ReactNode;
  lastKey: any;
  setLastKey: (lastKey: any) => void;
  pageSize: number;
  noneMessage?: string;
  itemsKey?: string;
  header: string;
  countRows?: (items: T[]) => number;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
  inCard?: boolean;
}

const IndefinitePaginatedList = <T,>({
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
  countRows,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  inCard = false,
}: IndefinitePaginatedListProps<T>) => {
  const { callApi } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const safeItems = useMemo(() => items ?? [], [items]);
  const pageCount = getIndefinitePageCount(safeItems, pageSize);
  const hasMore = hasIndefiniteMore(lastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<T>({
        callApi,
        fetchMoreRoute,
        items: safeItems,
        setItems,
        lastKey,
        setLastKey,
        setPage,
        pageSize,
        itemsKey,
        setLoading,
        targetPage,
        countRows,
      });
    },
    [callApi, fetchMoreRoute, lastKey, safeItems, setItems, pageSize, setLastKey, setLoading, itemsKey, countRows],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
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

  if (!inCard) {
    return (
      <Flexbox direction="col" gap="2">
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            {header}
          </Text>
          {pager}
        </Flexbox>
        {safeItems.length > 0 ? (
          <Flexbox direction="col" gap="2">
            <Row xs={12}>
              {safeItems.slice(page * pageSize, (page + 1) * pageSize).map((item, index) => (
                <Col key={index + page * pageSize} xs={xs} sm={sm} md={md} lg={lg} xl={xl} xxl={xxl}>
                  {renderItem(item)}
                </Col>
              ))}
            </Row>
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </Flexbox>
        ) : (
          <Text semibold lg>
            {noneMessage}
          </Text>
        )}
      </Flexbox>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            {header}
          </Text>
          {pager}
        </Flexbox>
      </CardHeader>
      <CardBody>
        {safeItems.length > 0 ? (
          <Flexbox direction="col" gap="2">
            <Row xs={12}>
              {safeItems.slice(page * pageSize, (page + 1) * pageSize).map((item, index) => (
                <Col key={index + page * pageSize} xs={xs} sm={sm} md={md} lg={lg} xl={xl} xxl={xxl}>
                  {renderItem(item)}
                </Col>
              ))}
            </Row>
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </Flexbox>
        ) : (
          <Text semibold lg>
            {noneMessage}
          </Text>
        )}
      </CardBody>
    </Card>
  );
};

export default IndefinitePaginatedList;
