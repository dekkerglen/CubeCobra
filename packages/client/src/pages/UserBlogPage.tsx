import React, { useCallback, useContext, useState } from 'react';

import BlogPostType from '@utils/datatypes/BlogPost';
import User from '@utils/datatypes/User';

import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import BlogPost from 'components/blog/BlogPost';
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

interface UserBlogPageProps {
  owner: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  posts: BlogPostType[];
  lastKey?: string;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
}

const PAGE_SIZE = 10;

const UserBlogPage: React.FC<UserBlogPageProps> = ({
  followersCount,
  followingCount,
  following,
  posts,
  owner,
  lastKey,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
}) => {
  const [items, setItems] = useState(posts);
  const { callApi } = useContext(CSRFContext);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<BlogPostType>({
        callApi,
        fetchMoreRoute: '/user/getmoreblogs',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'posts',
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

  return (
    <MainLayout>
      <UserLayout
        user={owner}
        followersCount={followersCount}
        followingCount={followingCount}
        following={following}
        activeLink="blog"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        <Flexbox direction="col" gap="2" className="w-full mt-3">
          <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
            <Text lg semibold>
              Blog Posts
            </Text>
            {pager}
          </Flexbox>
          {items.length > 0 ? (
            <>
              {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((post) => (
                <BlogPost key={post.id} post={post} />
              ))}
              <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
                {pager}
              </Flexbox>
            </>
          ) : (
            <Text className="text-text-secondary">This user has not posted any blogs yet.</Text>
          )}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserBlogPage);
