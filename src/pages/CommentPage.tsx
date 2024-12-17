import React, { useState } from 'react';

import { Card, CardHeader } from 'components/base/Card';
import Banner from 'components/Banner';
import Comment from 'components/comments/Comment';
import CommentsSection from 'components/comments/CommentsSection';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import CommentType from 'datatypes/Comment';
import Link from 'components/base/Link';

const translateType: { [key: string]: string } = {
  comment: 'Comment',
  blog: 'Blog Post',
  deck: 'Drafted Deck',
  card: 'Card Page',
  article: 'Article',
  podcast: 'Podcast',
  video: 'Video',
  episode: 'Podcast Episode',
  package: 'Card Package',
};

const translateLink: { [key: string]: (id: string) => string } = {
  comment: (id: string) => `/comment/${id}`,
  blog: (id: string) => `/cube/blog/blogpost/${id}`,
  deck: (id: string) => `/cube/deck/${id}`,
  card: (id: string) => `/tool/card/${id}`,
  article: (id: string) => `/content/article/${id}`,
  video: (id: string) => `/content/video/${id}`,
  podcast: (id: string) => `/content/podcast/${id}`,
  episode: (id: string) => `/content/episode/${id}`,
  package: (id: string) => `/packages/${id}`,
};

interface CommentPageProps {
  comment: CommentType;
  loginCallback?: string;
}

const CommentPage: React.FC<CommentPageProps> = ({ comment, loginCallback = '/' }) => {
  const [content, setContent] = useState<CommentType>(comment);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Link href={translateLink[content.type](content.parent)}>
            {`Responding to this ${translateType[content.type]}`}
          </Link>
        </CardHeader>
        <Comment
          comment={content}
          index={0}
          noReplies
          editComment={(editRequest) => setContent((prevContent) => ({ ...prevContent, ...editRequest }))}
        />
        <CommentsSection parentType="comment" parent={content.id} collapse={false} />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(CommentPage);
