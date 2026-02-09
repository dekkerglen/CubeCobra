import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { formatDateTime } from 'utils/Date';

import Pagination from '../base/Pagination';

interface CubeHistoryProps {
  changes?: Record<string, any>[];
  lastKey?: string;
}

const PAGE_SIZE = 18;

const CubeHistory: React.FC<CubeHistoryProps> = ({ changes, lastKey }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { cube } = useContext(CubeContext);
  const [items, setItems] = useState(changes);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(changes === undefined);

  const safeItems = useMemo(() => items ?? [], [items]);
  const pageCount = Math.ceil(safeItems.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  useEffect(() => {
    const fetchInitialData = async () => {
      if (items === undefined && cube?.id) {
        setInitialLoading(true);
        const response = await csrfFetch(`/cube/getmorechangelogs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cubeId: cube.id, lastKey: null }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success === 'true') {
            setItems(json.posts);
            setLastKey(json.lastKey);
          }
        }
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [items, cube?.id, csrfFetch]);

  const evens = useMemo(() => {
    return safeItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).filter((_, index) => index % 2 === 0);
  }, [safeItems, page]);

  const odds = useMemo(() => {
    return safeItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).filter((_, index) => index % 2 !== 0);
  }, [safeItems, page]);

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/cube/getmorechangelogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: safeItems[0]?.cubeId,
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...safeItems, ...json.posts]);
        setPage(page + 1);
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [currentLastKey, safeItems, page, csrfFetch]);

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

  if (initialLoading) {
    return (
      <Flexbox direction="col" alignItems="center" justify="center" className="py-8">
        <Spinner lg />
        <Text lg className="mt-4">
          Loading changelog...
        </Text>
      </Flexbox>
    );
  }

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
        <Text lg semibold>
          Changes ({safeItems.length}
          {hasMore ? '+' : ''})
        </Text>
        {pager}
      </Flexbox>
      <div className="block sm:hidden">
        {safeItems.length > 0 ? (
          safeItems.map((changelog) => (
            <Card className="mb-2" key={changelog.date}>
              <div style={{ overflow: 'auto', maxHeight: '20vh' }}>
                <CardBody>
                  <BlogPostChangelog changelog={changelog.changelog} />
                </CardBody>
              </div>
            </Card>
          ))
        ) : (
          <p>This cube has no history!</p>
        )}
      </div>
      <div className="hidden sm:block">
        <Row className="g-0 m-0 p-0">
          <Col xs={6} className="pe-4">
            {safeItems.length > 0 ? (
              evens.map((changelog) => (
                <Card className="my-2" key={changelog.date}>
                  <CardHeader className="text-right">
                    <Text semibold sm>
                      {formatDateTime(new Date(changelog.date))}
                    </Text>
                  </CardHeader>
                  <div style={{ overflow: 'auto', height: '15vh' }}>
                    <CardBody>
                      <BlogPostChangelog changelog={changelog.changelog} />
                    </CardBody>
                  </div>
                </Card>
              ))
            ) : (
              <p>This cube has no history!</p>
            )}
          </Col>
          <Col xs={6} className="pl-4">
            <div style={{ height: '8vh' }} />
            {odds.map((changelog) => (
              <Card className="my-2" key={changelog.date}>
                <CardHeader>
                  <Text semibold sm>
                    {formatDateTime(new Date(changelog.date))}
                  </Text>
                </CardHeader>
                <div style={{ overflow: 'auto', height: '15vh' }}>
                  <CardBody>
                    <BlogPostChangelog changelog={changelog.changelog} />
                  </CardBody>
                </div>
              </Card>
            ))}
          </Col>
        </Row>
      </div>{' '}
      <Flexbox direction="row" justify="end" alignItems="center" className="w-full px-2">
        {pager}
      </Flexbox>
    </Flexbox>
  );
};

export default CubeHistory;
