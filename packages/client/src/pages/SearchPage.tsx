import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import CubeSearchController from 'components/cube/CubeSearchController';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

interface SearchPageProps {
  cubes: Cube[];
  lastKey?: string;
  parsedQuery?: string[];
  query?: string;
}

const PAGE_SIZE = 36;

const SearchPage: React.FC<SearchPageProps> = ({ cubes, lastKey, parsedQuery, query }) => {
  const [items, setItems] = useState<Cube[]>(cubes);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);
  const { csrfFetch } = useContext(CSRFContext);
  const [currentParsedQuery, setCurrentParsedQuery] = useState(parsedQuery || []);

  const [currentQuery, setCurrentQuery] = useQueryParam('q', query || '');
  const [currentOrder, setCurrentOrder] = useQueryParam('order', 'pop');
  const [currentAscending, setCurrentAscending] = useQueryParam('ascending', 'false');

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/getmoresearchitems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
        query: currentQuery,
        order: currentOrder,
        ascending: currentAscending,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        const newItems = [...items, ...json.cubes];
        setItems(newItems);
        setCurrentParsedQuery(json.parsedQuery);

        const numItemsShowOnLastPage = items.length % PAGE_SIZE;
        const newItemsShowOnLastPage = newItems.length % PAGE_SIZE;

        if (numItemsShowOnLastPage === 0 && newItemsShowOnLastPage > 0) {
          setPage(page + 1);
        }
        setCurrentLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [csrfFetch, currentAscending, currentLastKey, currentOrder, currentQuery, items, page]);

  const go = useCallback(
    async (query: string, order: string, ascending: string) => {
      setCurrentQuery(query);
      setCurrentParsedQuery([]);
      setCurrentOrder(order);
      setCurrentAscending(ascending.toString());
      setLoading(true);
      setItems([]);
      setPage(0);

      const response = await csrfFetch(`/getmoresearchitems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          order,
          ascending,
          lastKey: null,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          setItems(json.cubes);
          setCurrentLastKey(json.lastKey);
          setCurrentParsedQuery(json.parsedQuery);
        }
      }
      setLoading(false);
    },
    [setCurrentQuery, setCurrentOrder, setCurrentAscending, csrfFetch],
  );

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

  return (
    <MainLayout>
      <CubeSearchController
        query={currentQuery}
        order={currentOrder}
        title="Cube Search"
        ascending={currentAscending}
        go={go}
      />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text lg semibold>
                Cubes Found ({items.length}
                {hasMore ? '+' : ''})
              </Text>
              {items.length > 0 && pager}
            </Flexbox>
            <Flexbox direction="row" justify="start" gap="2" className="w-full">
              <Text sm semibold italic>
                {(currentParsedQuery || []).join(', ')}
              </Text>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          {items.length > 0 ? (
            <Flexbox direction="col" gap="2">
              <Row xs={12}>
                {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
                  <Col key={cube.id} xxl={2} lg={3} md={4} xs={6}>
                    <CubePreview cube={cube} />
                  </Col>
                ))}
              </Row>
              <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
                {pager}
              </Flexbox>
            </Flexbox>
          ) : (
            <Text semibold lg>
              {loading ? <Spinner xl /> : 'No Results'}
            </Text>
          )}
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(SearchPage);
