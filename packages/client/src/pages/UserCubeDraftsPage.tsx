import React, { useCallback, useContext, useState } from 'react';

import Draft from '@utils/datatypes/Draft';

import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DeckPreview from 'components/DeckPreview';
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

interface UserCubeDraftsPageProps {
  decks: Draft[];
  lastKey: any;
}

const PAGE_SIZE = 36;

const UserCubeDraftsPage: React.FC<UserCubeDraftsPageProps> = ({ decks, lastKey }) => {
  const { callApi } = useContext(CSRFContext);
  const [items, setItems] = useState<Draft[]>(decks);
  const [currentLastKey, setCurrentLastKey] = useState<any>(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Draft>({
        callApi,
        fetchMoreRoute: '/dashboard/getmoredecks',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey: setCurrentLastKey,
        setPage,
        pageSize: PAGE_SIZE,
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
      <Flexbox direction="col" gap="3" className="my-3">
        <Flexbox direction="col" alignItems="start" gap="2" className="w-full md:hidden">
          <Text lg semibold>
            Drafts of your Cubes
          </Text>
          <div className="w-full">{pager}</div>
        </Flexbox>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full hidden md:flex">
          <Text lg semibold>
            Drafts of your Cubes
          </Text>
          {pager}
        </Flexbox>
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 5xl:grid-cols-6">
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((deck) => (
              <DeckPreview key={deck.id} deck={deck} />
            ))}
          </div>
        ) : (
          <Text>
            Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
            <Link href="https://discord.gg/YYF9x65Ane">Discord draft exchange?</Link>
          </Text>
        )}
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(UserCubeDraftsPage);
