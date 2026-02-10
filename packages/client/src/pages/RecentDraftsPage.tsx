import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface RecentDraftsPageProps {
  cubes: Cube[];
  lastKey?: string;
}

const PAGE_SIZE = 36;

const RecentDraftsPage: React.FC<RecentDraftsPageProps> = ({ cubes, lastKey }) => {
  const [items, setItems] = useState<Cube[]>(cubes);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);
  const { csrfFetch } = useContext(CSRFContext);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/recentdrafts/getmore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        const newItems = [...items, ...json.cubes];
        setItems(newItems);

        const numItemsShowOnLastPage = items.length % PAGE_SIZE;
        //If current page is full and we just fetched more items, then move to next page
        if (numItemsShowOnLastPage === 0 && json.cubes.length > 0) {
          setPage(page + 1);
        }
        setCurrentLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [csrfFetch, currentLastKey, items, page]);

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
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text lg semibold>
                Recently Drafted Cubes ({items.length}
                {hasMore ? '+' : ''})
              </Text>
              {items.length > 0 && pager}
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
              {loading ? <Spinner xl /> : 'No Recent Drafts'}
            </Text>
          )}
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(RecentDraftsPage);
