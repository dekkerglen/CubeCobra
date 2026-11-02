import React, { useCallback, useContext, useState } from 'react';

import User from '@utils/datatypes/User';

import CursorPagination from 'components/base/CursorPagination';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserPreview from 'components/UserPreview';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

const PAGE_SIZE = 36;

interface UserFollowersPageProps {
  owner: User;
  followers: User[];
  lastKey?: any;
  followersCount: number;
  followingCount: number;
  following: boolean;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
}

const UserFollowersPage: React.FC<UserFollowersPageProps> = ({
  owner,
  followers: initialFollowers,
  lastKey: initialLastKey,
  followersCount,
  followingCount,
  following,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
}) => {
  const { callApi } = useContext(CSRFContext);
  const [items, setItems] = useState<User[]>(initialFollowers);
  const [currentLastKey, setLastKey] = useState<any>(initialLastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMore = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<User>({
        callApi,
        fetchMoreRoute: `/user/followers/getmore/${owner.id}`,
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'followers',
        setLoading,
        targetPage,
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
          fetchMoreData: fetchMore,
        });
      }}
      loading={loading}
    />
  );

  const totalShown = items.length;
  const headerCount = followersCount ?? totalShown;

  return (
    <MainLayout>
      <UserLayout
        user={owner}
        followersCount={followersCount}
        followingCount={followingCount}
        following={following}
        activeLink="followers"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        <Flexbox direction="col" gap="2" className="mt-3 w-full">
          <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
            <Text lg semibold>
              Followers ({headerCount})
            </Text>
            {pager}
          </Flexbox>
          {totalShown > 0 ? (
            <Row>
              {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => (
                <Col key={item.id} xs={6} sm={4} md={3} lg={3} xl={2}>
                  <UserPreview user={item} />
                </Col>
              ))}
            </Row>
          ) : (
            <Text className="text-text-secondary">No followers yet.</Text>
          )}
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
            {pager}
          </Flexbox>
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserFollowersPage);
