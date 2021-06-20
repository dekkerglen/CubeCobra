import React from 'react';
import PropTypes from 'prop-types';
import CommentPropType from 'proptypes/CommentPropType';

import Comment from 'components/Comment';
import PagedList from 'components/PagedList';

const CommentList = ({ comments, startIndex, editComment }) => (
  <PagedList
    pageSize={10}
    rows={comments
      .slice(0)
      .reverse()
      .map((comment, index) => (
        <Comment
          key={`comment-${comment._id}`}
          comment={comment}
          index={startIndex + comments.length - index}
          editComment={editComment}
        />
      ))}
  />
);

CommentList.propTypes = {
  comments: PropTypes.arrayOf(CommentPropType).isRequired,
  startIndex: PropTypes.number,
  editComment: PropTypes.func.isRequired,
};

CommentList.defaultProps = {
  startIndex: 0,
};

export default CommentList;
