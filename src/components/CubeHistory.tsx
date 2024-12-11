import React, { useCallback, useMemo, useState } from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import { csrfFetch } from 'utils/CSRF';
import { formatDateTime } from 'utils/Date';
import Pagination from './base/Pagination';

interface CubeHistoryProps {
  changes: Record<string, any>[];
  lastKey?: string;
}

const PAGE_SIZE = 18;

const CubeHistory: React.FC<CubeHistoryProps> = ({ changes, lastKey }) => {
  const [items, setItems] = useState(changes);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = useState(false);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const evens = useMemo(() => {
    return items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).filter((_, index) => index % 2 === 0);
  }, [items, page]);

  const odds = useMemo(() => {
    return items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).filter((_, index) => index % 2 !== 0);
  }, [items, page]);

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/cube/getmorechangelogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: items[0].cubeId,
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.posts]);
        setPage(page + 1);
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [currentLastKey, items, page]);

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

  return (
    <Flexbox direction="col" gap="2" className="my-2">
      <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
        <Text lg semibold>
          Changes ({items.length}
          {hasMore ? '+' : ''})
        </Text>
        {pager}
      </Flexbox>
      <div className="block sm:hidden">
        {items.length > 0 ? (
          items.map((changelog) => (
            <Card className="my-2" key={changelog.date}>
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
            {items.length > 0 ? (
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
      <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
        {pager}
      </Flexbox>
    </Flexbox>
  );
};

export default CubeHistory;
