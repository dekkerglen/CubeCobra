import React, { useCallback, useContext, useState } from 'react';

import BlogPost from 'components/blog/BlogPost';
import CreateBlogModal from 'components/modals/CreateBlogModal';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import Spinner from 'components/base/Spinner';
import Cube from 'datatypes/Cube';
import PostType from 'datatypes/BlogPost';
import { Flexbox } from 'components/base/Layout';
import Button from 'components/base/Button';
import Text from 'components/base/Text';
import Controls from 'components/base/Controls';
import Link from 'components/base/Link';
import UserContext from 'contexts/UserContext';

interface CubeBlogPageProps {
  cube: Cube;
  lastKey: any;
  posts: PostType[];
  loginCallback?: string;
}

const CreateBlogModalLink = withModal(Link, CreateBlogModal);

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const CubeBlogPage: React.FC<CubeBlogPageProps> = ({ cube, lastKey, posts, loginCallback = '/' }) => {
  const user = useContext(UserContext);
  const [items, setItems] = useState<PostType[]>(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);

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
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [cube, currentLastKey, items]);

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
            items.map((post) => <BlogPost key={post.id} post={post} />)
          ) : (
            <Text lg semibold>
              No blog posts for this cube.
            </Text>
          )}
          {loading && loader}
          {!loading && currentLastKey && (
            <Button onClick={fetchMoreData} disabled={loading}>
              Load More
            </Button>
          )}
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeBlogPage);
