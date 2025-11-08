import React, { useCallback, useContext, useState } from 'react';

import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import BlogPost from 'components/blog/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import BlogPostType from '@utils/datatypes/BlogPost';
import User from '@utils/datatypes/User';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';

interface UserBlogPageProps {
  owner: User;
  followersCount: number;
  following: boolean;
  posts: BlogPostType[];
  lastKey?: string;
}

const PAGE_SIZE = 10;

const UserBlogPage: React.FC<UserBlogPageProps> = ({
  followersCount,
  following,
  posts,
  owner,
  lastKey,
}) => {
  const [items, setItems] = useState(posts);
  const { csrfFetch } = useContext(CSRFContext);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/user/getmoreblogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: owner.id,
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

      setLoading(false);
    }
  }, [csrfFetch, owner.id, currentLastKey, items, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        // eslint-disable-next-line no-console -- Debugging
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
    <MainLayout>
      <UserLayout user={owner} followersCount={followersCount} following={following} activeLink="blog">
        <DynamicFlash />
        {items.length > 0 ? (
          <Flexbox direction="col" gap="2" className="w-full my-3">
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text lg semibold>
                Blog Posts ({items.length}
                {hasMore ? '+' : ''})
              </Text>
              {pager}
            </Flexbox>
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((post) => (
              <BlogPost key={post.id} post={post} />
            ))}
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </Flexbox>
        ) : (
          <p className="my-3">This user has no blog posts!</p>
        )}
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserBlogPage);
