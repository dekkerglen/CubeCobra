import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import UserLayout from 'layouts/UserLayout';
import BlogPost from 'components/BlogPost';
import Paginate from 'components/Paginate';
import DynamicFlash from 'components/DynamicFlash';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const UserBlogPage = ({ user, followers, following, posts, owner, loginCallback, pages, activePage }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <UserLayout
      user={owner}
      followers={followers}
      following={following}
      canEdit={user && user.id === owner._id}
      activeLink="blog"
    >
      <Advertisement user={user} />
      <DynamicFlash />

      {pages > 1 && (
        <Paginate count={pages} active={parseInt(activePage, 10)} urlF={(i) => `/user/blog/${owner._id}/${i}`} />
      )}
      {posts.length > 0 ? (
        posts
          .slice(0)
          .map((post) => (
            <BlogPost
              key={post._id}
              post={post}
              canEdit={user && user.id === owner._id}
              userid={user && user.id}
              loggedIn
            />
          ))
      ) : (
        <p>This user has no blog posts!</p>
      )}

      {pages > 1 && (
        <Paginate count={pages} active={parseInt(activePage, 10)} urlF={(i) => `/user/blog/${owner._id}/${i}`} />
      )}
    </UserLayout>
  </MainLayout>
);

UserBlogPage.propTypes = {
  user: UserPropType,
  owner: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  posts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  loginCallback: PropTypes.string,
};

UserBlogPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(UserBlogPage);
