import React from 'react';

import PropTypes from 'prop-types';
import CommentPropType from 'proptypes/CommentPropType';

import Comment from 'components/Comment';
import PagedList from 'components/PagedList';

const CommentList = ({ comments, editComment }) => (
  <PagedList
    pageSize={10}
    rows={comments.map((comment, index) => (
      <Comment key={`comment-${comment.id}`} comment={comment} index={index} editComment={editComment} />
    ))}
  />
);

CommentList.propTypes = {
  comments: PropTypes.arrayOf(CommentPropType).isRequired,
  editComment: PropTypes.func.isRequired,
};

export default CommentList;
