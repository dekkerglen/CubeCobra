import React, { useCallback, useState } from 'react';

import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import Cube from 'datatypes/Cube';
import { Row, Col, Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import useQueryParam from 'hooks/useQueryParam';
import CubeSearchController from 'components/cube/CubeSearchController';
import { Card, CardBody, CardHeader } from 'components/base/Card';

interface SearchPageProps {
  cubes: Cube[];
  loginCallback?: string;
  lastKey?: string;
}

const PAGE_SIZE = 36;

const SearchPage: React.FC<SearchPageProps> = ({ cubes, loginCallback, lastKey }) => {
  const [items, setItems] = useState<Cube[]>(cubes);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const [currentQuery, setCurrentQuery] = useQueryParam('q', '');
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
        setItems([...items, ...json.cubes]);
        setPage(page + 1);
        setCurrentLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [currentAscending, currentLastKey, currentOrder, currentQuery, items, page]);

  const go = useCallback(
    async (query: string, order: string, ascending: string) => {
      setCurrentQuery(query);
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
          console.log(json);
          setItems(json.cubes);
          setCurrentLastKey(json.lastKey);
        }
      }
      setLoading(false);
    },
    [setCurrentAscending, setCurrentOrder, setCurrentQuery, setCurrentLastKey],
  );

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        console.log(newPage, pageCount);
        if (newPage >= pageCount) {
          await fetchMoreData();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );

  console.log(items);

  return (
    <MainLayout loginCallback={loginCallback}>
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
          <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
            <Text lg semibold>
              Cubes Found ({items.length}
              {hasMore ? '+' : ''})
            </Text>
            {items.length > 0 && pager}
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
              No Results
            </Text>
          )}
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(SearchPage);
