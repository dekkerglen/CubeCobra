import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DownloadIcon, EyeIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { formatDateTime } from 'utils/Date';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

import CursorPagination from '../base/CursorPagination';

interface CubeHistoryProps {
  changes?: Record<string, any>[];
  lastKey?: string;
}

const PAGE_SIZE = 18;

const CubeHistory: React.FC<CubeHistoryProps> = ({ changes, lastKey }) => {
  const { csrfFetch, callApi } = useContext(CSRFContext);
  const { cube } = useContext(CubeContext);
  const [items, setItems] = useState(changes);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(changes === undefined);

  const safeItems = useMemo(() => items ?? [], [items]);
  const pageCount = getIndefinitePageCount(safeItems, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  // `cubeId` is read outside the callbacks below so the compiler infers a dependency on that value
  // rather than on `cube`, which would stop it preserving the memoization.
  const cubeId = cube?.id;

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

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Record<string, any>>({
        callApi,
        fetchMoreRoute: '/cube/getmorechangelogs',
        items: safeItems,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'posts',
        setLoading,
        targetPage,
        body: { cubeId },
      });
    },
    [callApi, currentLastKey, safeItems, cubeId],
  );

  const [dateValue, setDateValue] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const handleDateJump = useCallback(() => {
    if (!dateValue || !cubeId) return;
    const dateMs = new Date(dateValue).getTime();
    window.location.href = `/cube/changelog/${cubeId}/at?date=${dateMs}`;
  }, [dateValue, cubeId]);

  const cubeName = cube?.name;
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  // Pages through the history API and builds the file here, so no single request has to load the
  // whole history.
  const handleExport = useCallback(async () => {
    if (!cubeId) return;
    setExporting(true);
    setExportFailed(false);
    try {
      const changelogs: Record<string, any>[] = [];
      let cursor: string | undefined;
      do {
        const params = new URLSearchParams({ limit: '100', includeChanges: 'true' });
        if (cursor) params.set('cursor', cursor);
        const response = await csrfFetch(`/cube/api/history/${encodeURIComponent(cubeId)}?${params}`);
        if (!response.ok) throw new Error('Failed to export changelog');
        const json = await response.json();
        changelogs.push(...json.changelogs);
        cursor = json.nextCursor;
      } while (cursor);

      const file = { cubeId, cubeName, exportedAt: new Date().toISOString(), changelogs: changelogs.reverse() };
      const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(cubeName ?? '').replace(/\W/g, '') || 'cube'}_changelog.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  }, [csrfFetch, cubeId, cubeName]);

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
      <Flexbox direction="row" justify="end" alignItems="center" className="w-full" gap="2">
        <Text sm className="text-text-secondary">
          Jump to a Point in Time
        </Text>
        <div className="max-w-32">
          <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
        </div>
        <Button color="accent" type="button" onClick={handleDateJump}>
          Go
        </Button>
      </Flexbox>
      <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
        <Text lg semibold>
          Changes
        </Text>
        <Flexbox direction="row" gap="3" alignItems="center">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer text-nowrap disabled:cursor-default disabled:opacity-60"
          >
            {exporting ? <Spinner sm /> : <DownloadIcon size={16} />}
            <Text sm>Export All</Text>
          </button>
          {pager}
        </Flexbox>
      </Flexbox>
      {exportFailed && <Text className="text-red-600">Failed to export changelog.</Text>}
      <div className="block sm:hidden">
        {safeItems.length > 0 ? (
          safeItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((changelog) => (
            <Card className="mb-2" key={changelog.date}>
              <CardHeader>
                <Flexbox direction="row" justify="between" alignItems="center">
                  <Link href={`/cube/changelog/${changelog.cubeId}/${changelog.id}`}>
                    <Text semibold sm>
                      {formatDateTime(new Date(changelog.date))}
                    </Text>
                  </Link>
                  <Tooltip text="View cube at this point in time" wrapperTag="span">
                    <Button
                      color="accent"
                      type="link"
                      href={`/cube/changelog/${changelog.cubeId}/${changelog.id}/list`}
                    >
                      <EyeIcon size={14} />
                    </Button>
                  </Tooltip>
                </Flexbox>
              </CardHeader>
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
                  <CardHeader>
                    <Flexbox direction="row" justify="between" alignItems="center">
                      <Link href={`/cube/changelog/${changelog.cubeId}/${changelog.id}`}>
                        <Text semibold sm>
                          {formatDateTime(new Date(changelog.date))}
                        </Text>
                      </Link>
                      <Tooltip text="View cube at this point in time" wrapperTag="span">
                        <Button
                          color="accent"
                          type="link"
                          href={`/cube/changelog/${changelog.cubeId}/${changelog.id}/list`}
                        >
                          <EyeIcon size={14} />
                        </Button>
                      </Tooltip>
                    </Flexbox>
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
                  <Flexbox direction="row" justify="between" alignItems="center">
                    <Link href={`/cube/changelog/${changelog.cubeId}/${changelog.id}`}>
                      <Text semibold sm>
                        {formatDateTime(new Date(changelog.date))}
                      </Text>
                    </Link>
                    <Tooltip text="View cube at this point in time" wrapperTag="span">
                      <Button
                        color="accent"
                        type="link"
                        href={`/cube/changelog/${changelog.cubeId}/${changelog.id}/list`}
                      >
                        <EyeIcon size={14} />
                      </Button>
                    </Tooltip>
                  </Flexbox>
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
