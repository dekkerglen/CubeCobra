import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import { Collapse, Nav, Navbar, NavItem, NavLink, Spinner } from 'reactstrap';

import BlogPost from 'components/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import CubeLayout from 'layouts/CubeLayout';
import InfiniteScroll from 'react-infinite-scroll-component';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const CubeBlogPage = ({ cube, lastKey, posts, loginCallback }) => {
  const [items, setItems] = useState(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/blog/getmoreblogsbycube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cube,
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      console.log(json);
      if (json.success === 'true') {
        setItems([...items, ...json.posts]);
        setLastKey(json.lastKey);
      }
    }
  }, [cube, currentLastKey, items]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="blog">
        <Navbar expand light className="usercontrols mb-3">
          <Collapse navbar>
            <Nav navbar>
              <NavItem>
                <NavLink>Create new blog post</NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
        <DynamicFlash />
        <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey != null} loader={loader}>
          {items.length > 0 ? (
            items.map((post) => <BlogPost key={post._id} post={post} />)
          ) : (
            <h5>No blog posts for this cube.</h5>
          )}
        </InfiniteScroll>
      </CubeLayout>
    </MainLayout>
  );
};

CubeBlogPage.propTypes = {
  cube: CubePropType.isRequired,
  lastKey: PropTypes.shape({}),
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      markdown: PropTypes.string,
    }),
  ).isRequired,
  loginCallback: PropTypes.string,
};

CubeBlogPage.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(CubeBlogPage);
