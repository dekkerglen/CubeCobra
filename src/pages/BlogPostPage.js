import React from 'react';
import PropTypes from 'prop-types';

import BlogPost from 'components/BlogPost';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const BlogPostPage = ({ post, user }) => (
  <MainLayout user={user}>
    <Advertisement />
    <DynamicFlash />
    <BlogPost key={post._id} post={post} canEdit={false} userid={user ? user.id : null} loggedIn={user !== null} />
  </MainLayout>
);

BlogPostPage.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

BlogPostPage.defaultProps = {
  user: null,
};

export default RenderToRoot(BlogPostPage);
