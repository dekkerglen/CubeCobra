import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import withQuickCreateCube from 'components/QuickCreateCubeButton';
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

interface UserCubePageProps {
  owner: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  cubes: Cube[];
  lastKey?: any;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
}

const PAGE_SIZE = 36;

const CreateCubeButton = withQuickCreateCube(Button);

export const UserCubePage: React.FC<UserCubePageProps> = ({
  owner,
  followersCount,
  followingCount,
  following,
  cubes: initialCubes,
  lastKey: initialLastKey,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
}) => {
  const user = useContext(UserContext);
  const { callApi } = useContext(CSRFContext);
  const [items, setItems] = useState<Cube[]>(initialCubes);
  const [currentLastKey, setLastKey] = useState(initialLastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Cube>({
        callApi,
        fetchMoreRoute: '/user/getmorecubes',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'cubes',
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
        activeLink="view"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        <Flexbox direction="col" className="mt-3" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
            <Text lg semibold>
              Cubes
            </Text>
            <Flexbox direction="row" gap="2" wrap="wrap" alignItems="center">
              {isOwner && <CreateCubeButton color="primary">Create New</CreateCubeButton>}
              {pager}
            </Flexbox>
          </Flexbox>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 5xl:grid-cols-6">
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
              <CubePreview key={cube.id} cube={cube} />
            ))}
          </div>
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
            {pager}
          </Flexbox>
          {items.length === 0 && <Text className="text-text-secondary">This user has not created any cubes yet.</Text>}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserCubePage);
