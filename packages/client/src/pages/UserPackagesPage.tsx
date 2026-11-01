import React, { useCallback, useContext, useState } from 'react';

import CardPackageData from '@utils/datatypes/CardPackage';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardPackage from 'components/card/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

interface UserPackagesPageProps {
  owner: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  packages: CardPackageData[];
  lastKey?: any;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
}

const PAGE_SIZE = 36;

const UserPackagesPage: React.FC<UserPackagesPageProps> = ({
  owner,
  followersCount,
  followingCount,
  following,
  packages: initialPackages,
  lastKey: initialLastKey,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
}) => {
  const user = useContext(UserContext);
  const { callApi } = useContext(CSRFContext);
  const [items, setItems] = useState<CardPackageData[]>(initialPackages);
  const [currentLastKey, setLastKey] = useState(initialLastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<CardPackageData>({
        callApi,
        fetchMoreRoute: '/user/getmorepackages',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'packages',
        setLoading,
        targetPage,
        body: { owner: owner.id },
      });
    },
    [callApi, owner.id, currentLastKey, items],
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

  const isOwner = !!user && user.id === owner.id;

  return (
    <MainLayout>
      <UserLayout
        user={owner}
        followersCount={followersCount}
        followingCount={followingCount}
        following={following}
        activeLink="packages"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        <Flexbox direction="col" className="mt-3" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
            <Text lg semibold>
              Packages
            </Text>
            <Flexbox direction="row" gap="2" wrap="wrap" alignItems="center">
              {isOwner && (
                <Button type="link" color="primary" href="/packages/create">
                  Create New
                </Button>
              )}
              {pager}
            </Flexbox>
          </Flexbox>

          {items.length > 0 ? (
            <Flexbox direction="col" gap="2">
              {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((pack) => (
                <CardPackage key={pack.id} cardPackage={pack} />
              ))}
              <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
                {pager}
              </Flexbox>
            </Flexbox>
          ) : (
            <Text className="text-text-secondary">This user has not created any packages yet.</Text>
          )}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserPackagesPage);
