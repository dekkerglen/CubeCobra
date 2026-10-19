import React, { useContext, useState } from 'react';

import CommentType from '@utils/datatypes/Comment';

import Banner from 'components/Banner';
import { Card, CardHeader } from 'components/base/Card';
import Link from 'components/base/Link';
import Comment from 'components/comments/Comment';
import CommentsSection from 'components/comments/CommentsSection';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import { EditRequest } from 'hooks/UseComments';
import MainLayout from 'layouts/MainLayout';

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
  record: 'Record',
  p1p1: 'Pack 1 Pick 1',
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
  record: (id: string) => `/cube/record/${id}`,
  p1p1: (id: string) => `/cube/p1p1/${id}`,
};

interface CommentPageProps {
  comment: CommentType;
}

const CommentPage: React.FC<CommentPageProps> = ({ comment }) => {
  const [content, setContent] = useState<CommentType>(comment);
  const { csrfFetch } = useContext(CSRFContext);

  const editComment = async (editRequest: EditRequest) => {
    const response = await csrfFetch('/comment/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: editRequest }),
    });

    if (!response.ok) {
      console.error('Failed to edit comment');
      return;
    }

    setContent((prevContent) =>
      editRequest.remove
        ? { ...prevContent, body: '[deleted]', owner: { id: '404', username: 'Anonymous' } as CommentType['owner'] }
        : { ...prevContent, body: editRequest.content ?? prevContent.body },
    );
  };

  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Link href={translateLink[content.type](content.parent)}>
            {`Responding to this ${translateType[content.type]}`}
          </Link>
        </CardHeader>
        <Comment comment={content} index={0} noReplies editComment={editComment} />
        <CommentsSection parentType="comment" parent={content.id} collapse={false} />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(CommentPage);
