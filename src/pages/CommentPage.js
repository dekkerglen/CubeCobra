import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader } from 'reactstrap';

import Comment from 'components/Comment';
import DynamicFlash from 'components/DynamicFlash';
import CommentsSection from 'components/CommentsSection';

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

const CommentPage = ({ comment, userid }) => {
  return (
    <div className="pb-2">
      <DynamicFlash />
      <Card className="mt-2">
        <CardHeader>
          <a href={translateLink[comment.parentType](comment.parent)}>
            {`Responding to this ${translateType[comment.parentType]}`}
          </a>
        </CardHeader>
        <Comment comment={comment} userid={userid} index={0} noReplies />
        <div className="ml-4 border-left border-top">
          <CommentsSection parentType="comment" parent={comment._id} userid={userid} />
        </div>
      </Card>
    </div>
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
  userid: PropTypes.string,
};

CommentPage.defaultProps = {
  userid: null,
};

export default CommentPage;
