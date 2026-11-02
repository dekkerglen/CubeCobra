import React, { useCallback, useContext, useState } from 'react';

import Draft from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';

import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

interface UserDecksPageProps {
  owner: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  decks: Draft[];
  lastKey?: any;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
}

const PAGE_SIZE = 20;

const UserDecksPage: React.FC<UserDecksPageProps> = ({
  followersCount,
  followingCount,
  following,
  decks,
  owner,
  lastKey,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
}) => {
  const { callApi } = useContext(CSRFContext);
  const [items, setItems] = useState<Draft[]>(decks);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Draft>({
        callApi,
        fetchMoreRoute: '/user/getmoredecks',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'decks',
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
      <UserLayout
        user={owner}
        followersCount={followersCount}
        followingCount={followingCount}
        following={following}
        activeLink="decks"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        <Flexbox direction="col" gap="2" className="mt-3 w-full">
          <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
            <Text lg semibold>
              Drafts
            </Text>
            {pager}
          </Flexbox>

          {items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 5xl:grid-cols-6">
                {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((deck) => (
                  <DeckPreview key={deck.id} deck={deck} />
                ))}
              </div>
              <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
                {pager}
              </Flexbox>
            </>
          ) : (
            <Text className="text-text-secondary">This user has not drafted any decks yet.</Text>
          )}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserDecksPage);
