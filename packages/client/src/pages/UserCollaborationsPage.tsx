import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';

import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import { clampPage, getIndefinitePageCount, handleIndefinitePageSelection } from 'utils/indefinitePagination';

interface UserCollaborationsPageProps {
  owner: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  cubes: Cube[];
  nextOffset: number;
  hasMore: boolean;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
}

const PAGE_SIZE = 36;

export const UserCollaborationsPage: React.FC<UserCollaborationsPageProps> = ({
  owner,
  followersCount,
  followingCount,
  following,
  cubes: initialCubes,
  nextOffset: initialOffset,
  hasMore: initialHasMore,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Cube[]>(initialCubes);
  const [offset, setOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);

  // This endpoint pages by numeric offset with an explicit hasMore flag rather than by cursor, so
  // fetchIndefiniteMoreData (which is built around a lastKey) does not apply. The page the user
  // asked for is still threaded through and clamped to what the fetch actually produced.
  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      setLoading(true);

      const response = await csrfFetch(`/user/getmorecollaborations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: owner.id,
          offset,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          const newItems = [...items, ...json.cubes];
          setItems(newItems);
          setPage(clampPage(targetPage, getIndefinitePageCount(newItems, PAGE_SIZE)));
          setOffset(json.nextOffset);
          setHasMore(json.hasMore);
        }
      }

      setLoading(false);
    },
    [csrfFetch, owner.id, offset, items],
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
        activeLink="collaborations"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        <Flexbox direction="col" className="mt-3" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
            <Text lg semibold>
              Collaborations
            </Text>
            {pager}
          </Flexbox>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 5xl:grid-cols-6">
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
              <CubePreview key={cube.id} cube={cube} />
            ))}
          </div>
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
            {pager}
          </Flexbox>
          {items.length === 0 && (
            <Text className="text-text-secondary">
              {isOwner
                ? 'You are not a collaborator on any cubes yet.'
                : 'This user is not a collaborator on any cubes yet.'}
            </Text>
          )}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserCollaborationsPage);
