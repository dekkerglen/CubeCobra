import React from 'react';
import PropTypes from 'prop-types';

import BlogPost from 'components/BlogPost';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import BlogPostPropType from 'proptypes/BlogPostPropType';
import CubePropType from 'proptypes/CubePropType';

const BlogPostPage = ({ post, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <BlogPost key={post.id} cube={cube} post={post} noScroll />
  </MainLayout>
);

BlogPostPage.propTypes = {
  post: BlogPostPropType.isRequired,
  cube: CubePropType,
  loginCallback: PropTypes.string,
};

BlogPostPage.defaultProps = {
  cube: null,
  loginCallback: '/',
};

export default RenderToRoot(BlogPostPage);
