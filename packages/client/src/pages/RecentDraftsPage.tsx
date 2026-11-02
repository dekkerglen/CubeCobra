import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

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
  const { callApi } = useContext(CSRFContext);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Cube>({
        callApi,
        fetchMoreRoute: '/recentdrafts/getmore',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey: setCurrentLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'cubes',
        setLoading,
        targetPage,
      });
    },
    [callApi, currentLastKey, items],
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

  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text lg semibold>
                Recently Drafted Cubes
              </Text>
              {pager}
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          {items.length > 0 ? (
            <Flexbox direction="col" gap="2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 5xl:grid-cols-6">
                {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
                  <CubePreview key={cube.id} cube={cube} />
                ))}
              </div>
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
