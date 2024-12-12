import React, { useState, useCallback } from 'react';
import { csrfFetch } from 'utils/CSRF';
import { Card, CardBody, CardHeader } from './base/Card';
import Text from 'components/base/Text';
import { Col, Flexbox, Row } from './base/Layout';
import Pagination from './base/Pagination';

interface IndefinitePaginatedListProps<T> {
  items: T[];
  setItems: (items: T[]) => void;
  fetchMoreRoute: string;
  renderItem: (item: T) => React.ReactNode;
  lastKey: any;
  setLastKey: (lastKey: any) => void;
  pageSize: number;
  noneMessage?: string;
  header: string;
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
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  inCard = false,
}: IndefinitePaginatedListProps<T>) => {
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / pageSize);
  const hasMore = !!lastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);
    const response = await csrfFetch(fetchMoreRoute, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: lastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      console.log(json);
      if (json.success === 'true') {
        const newItems = [...items, ...json.items];
        setItems(newItems);

        const numItemsShowOnLastPage = items.length % pageSize;
        const newItemsShowOnLastPage = newItems.length % pageSize;

        if (numItemsShowOnLastPage === 0 && newItemsShowOnLastPage > 0) {
          setPage(page + 1);
        }
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [lastKey, items, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        if (newPage >= pageCount) {
          await fetchMoreData();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );

  if (!inCard) {
    return (
      <Flexbox direction="col" gap="2">
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            {header} ({items.length}
            {hasMore ? '+' : ''})
          </Text>
          {items.length > 0 && pager}
        </Flexbox>
        {items.length > 0 ? (
          <Flexbox direction="col" gap="2">
            <Row xs={12}>
              {items.slice(page * pageSize, (page + 1) * pageSize).map((item, index) => (
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
            {header} ({items.length}
            {hasMore ? '+' : ''})
          </Text>
          {items.length > 0 && pager}
        </Flexbox>
      </CardHeader>
      <CardBody>
        {items.length > 0 ? (
          <Flexbox direction="col" gap="2">
            <Row xs={12}>
              {items.slice(page * pageSize, (page + 1) * pageSize).map((item, index) => (
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
