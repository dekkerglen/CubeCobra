import React from 'react';
import PropTypes from 'prop-types';

import UserLayout from 'layouts/UserLayout';
import BlogPost from 'components/BlogPost';
import PagedList from 'components/PagedList';
import DynamicFlash from 'components/DynamicFlash';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const UserBlogPage = ({ user, followers, following, posts, owner, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <UserLayout
      user={owner}
      followers={followers}
      following={following}
      canEdit={user && user.id === owner._id}
      activeLink="blog"
    >
      <Advertisement />
      <DynamicFlash />
      {posts.length > 0 ? (
        <PagedList
          pageSize={10}
          showBottom
          rows={posts.slice(0).map((post) => (
            <BlogPost key={post._id} post={post} canEdit={user && user.id === owner._id} userid={user.id} loggedIn />
          ))}
        />
      ) : (
        <p>This user has no blog posts!</p>
      )}
    </UserLayout>
  </MainLayout>
);

UserBlogPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  owner: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  posts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  loginCallback: PropTypes.string,
};

UserBlogPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(UserBlogPage);
