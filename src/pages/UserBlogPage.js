import React, { useCallback, useState } from 'react';
import { Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import InfiniteScroll from 'react-infinite-scroll-component';

import Banner from 'components/Banner';
import BlogPost from 'components/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const UserBlogPage = ({ followers, following, posts, owner, loginCallback, lastKey }) => {
  const [items, setItems] = useState(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

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
        setLastKey(json.lastKey);
      }
    }
  }, [owner.id, currentLastKey, items]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <UserLayout user={owner} followers={followers} following={following} activeLink="blog">
        <Banner />
        <DynamicFlash />
        <InfiniteScroll
          dataLength={items.length}
          next={fetchMoreData}
          hasMore={currentLastKey !== null}
          loader={loader}
        >
          {items.length > 0 ? (
            items.map((post) => <BlogPost key={post.id} post={post} />)
          ) : (
            <p>This user has no blog posts!</p>
          )}
        </InfiniteScroll>
      </UserLayout>
    </MainLayout>
  );
};

UserBlogPage.propTypes = {
  owner: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  posts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  loginCallback: PropTypes.string,
  lastKey: PropTypes.shape({}),
};

UserBlogPage.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(UserBlogPage);
