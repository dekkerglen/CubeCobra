import React, { useCallback, useContext, useState } from 'react';

import Controls from 'components/base/Controls';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import BlogPost from 'components/blog/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import CreateBlogModal from 'components/modals/CreateBlogModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import PostType from 'datatypes/BlogPost';
import Cube from 'datatypes/Cube';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';

interface CubeBlogPageProps {
  cube: Cube;
  lastKey: any;
  posts: PostType[];
  loginCallback?: string;
}

const CreateBlogModalLink = withModal(Link, CreateBlogModal);

const PAGE_SIZE = 20;

const CubeBlogPage: React.FC<CubeBlogPageProps> = ({ cube, lastKey, posts, loginCallback = '/' }) => {
  const user = useContext(UserContext);
  const [items, setItems] = useState<PostType[]>(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);
    const response = await csrfFetch(`/cube/blog/getmoreblogsbycube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cube: cube.id,
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
    }
    setLoading(false);
  }, [cube, currentLastKey, items, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
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
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="blog" hasControls={user != null && cube.owner.id == user.id}>
        <Controls>
          <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="py-2 px-4">
            <CreateBlogModalLink color="primary" modalprops={{ cubeID: cube.id, post: null }}>
              Create new blog post
            </CreateBlogModalLink>
          </Flexbox>
        </Controls>
        <Flexbox direction="col" gap="2" className="my-2">
          <DynamicFlash />
          {items.length > 0 ? (
            <>
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
            </>
          ) : (
            <Text lg semibold>
              No blog posts for this cube.
            </Text>
          )}
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeBlogPage);
