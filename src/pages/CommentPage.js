import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader } from 'reactstrap';

import Comment from 'components/Comment';
import DynamicFlash from 'components/DynamicFlash';
import CommentsSection from 'components/CommentsSection';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Advertisement from 'components/Advertisement';

const translateType = {
  comment: 'Comment',
  blog: 'Blog Post',
  deck: 'Drafted Deck',
  card: 'Card Page',
};

const translateLink = {
  comment: (id) => `/comment/${id}`,
  blog: (id) => `/cube/blogpost/${id}`,
  deck: (id) => `/cube/deck/${id}`,
  card: (id) => `/tool/card/${id}`,
};

const CommentPage = ({ comment, user }) => {
  const [content, setContent] = useState(comment);

  return (
    <MainLayout user={user}>
      <Advertisement />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <a href={translateLink[content.parentType](content.parent)}>
            {`Responding to this ${translateType[content.parentType]}`}
          </a>
        </CardHeader>
        <Comment comment={content} userid={user && user.id} index={0} noReplies editComment={setContent} />
        <div className="border-top">
          <CommentsSection parentType="comment" parent={content._id} userid={user && user.id} />
        </div>
      </Card>
    </MainLayout>
  );
};

CommentPage.propTypes = {
  comment: PropTypes.shape({
    timePosted: PropTypes.instanceOf(Date).isRequired,
    ownerName: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    updated: PropTypes.bool.isRequired,
    _id: PropTypes.string.isRequired,
    parentType: PropTypes.string.isRequired,
    parent: PropTypes.string.isRequired,
  }).isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

CommentPage.defaultProps = {
  user: null,
};

export default RenderToRoot(CommentPage);
