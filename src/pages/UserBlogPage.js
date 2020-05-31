import React from 'react';
import PropTypes from 'prop-types';

import UserLayout from 'layouts/UserLayout';
import BlogPost from 'components/BlogPost';
import PagedList from 'components/PagedList';

const UserDecksPage = ({ user, followers, following, canEdit, posts, userId }) => (
  <UserLayout user={user} followers={followers} following={following} canEdit={canEdit} activeLink="blog">
    {posts.length > 0 ? (
      <PagedList
        pageSize={10}
        showBottom
        rows={posts.slice(0).map((post) => (
          <BlogPost key={post._id} post={post} canEdit={false} userid={userId} loggedIn />
        ))}
      />
    ) : (
      <p>This user has no blog posts!</p>
    )}
  </UserLayout>
);

UserDecksPage.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool.isRequired,
  posts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  userId: PropTypes.string,
};

UserDecksPage.defaultProps = {
  userId: '',
};

export default UserDecksPage;
