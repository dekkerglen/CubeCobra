import React from 'react';

import Banner from 'components/Banner';
import BlogPost from 'components/blog/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import BlogPostType from 'datatypes/BlogPost';
import MainLayout from 'layouts/MainLayout';

interface BlogPostPageProps {
  post: BlogPostType;
  loginCallback?: string;
}

const BlogPostPage: React.FC<BlogPostPageProps> = ({ post, loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <BlogPost key={post.id} post={post} noScroll className="my-2" />
  </MainLayout>
);

export default RenderToRoot(BlogPostPage);
