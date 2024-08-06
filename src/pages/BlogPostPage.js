import React from 'react';

import PropTypes from 'prop-types';
import BlogPostPropType from 'proptypes/BlogPostPropType';

import Banner from 'components/Banner';
import BlogPost from 'components/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const BlogPostPage = ({ post, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <BlogPost key={post.id} post={post} noScroll />
  </MainLayout>
);

BlogPostPage.propTypes = {
  post: BlogPostPropType.isRequired,
  loginCallback: PropTypes.string,
};

BlogPostPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(BlogPostPage);
