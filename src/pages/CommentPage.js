import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CommentPropType from 'proptypes/CommentPropType';

import { Card, CardHeader } from 'reactstrap';

import Comment from 'components/Comment';
import DynamicFlash from 'components/DynamicFlash';
import CommentsSection from 'components/CommentsSection';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Banner from 'components/Banner';

const translateType = {
  comment: 'Comment',
  blog: 'Blog Post',
  deck: 'Drafted Deck',
  card: 'Card Page',
  article: 'Article',
  podcast: 'Podcast',
  video: 'Video',
  episode: 'Podcast Epsiode',
  package: 'Card Package',
};

const translateLink = {
  comment: (id) => `/comment/${id}`,
  blog: (id) => `/cube/blog/blogpost/${id}`,
  deck: (id) => `/cube/deck/${id}`,
  card: (id) => `/tool/card/${id}`,
  article: (id) => `/content/article/${id}`,
  video: (id) => `/content/video/${id}`,
  podcast: (id) => `/content/podcast/${id}`,
  episode: (id) => `/content/episode/${id}`,
  package: (id) => `/packages/${id}`,
};

const CommentPage = ({ comment, loginCallback }) => {
  const [content, setContent] = useState(comment);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <a href={translateLink[content.parentType](content.parent)}>
            {`Responding to this ${translateType[content.parentType]}`}
          </a>
        </CardHeader>
        <Comment comment={content} index={0} noReplies editComment={setContent} />
        <div className="border-top">
          <CommentsSection parentType="comment" parent={content._id} />
        </div>
      </Card>
    </MainLayout>
  );
};

CommentPage.propTypes = {
  comment: CommentPropType.isRequired,
  loginCallback: PropTypes.string,
};

CommentPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CommentPage);
