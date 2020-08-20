import React from 'react';
import PropTypes from 'prop-types';

import Comment from 'components/Comment';
import PagedList from 'components/PagedList';

const CommentList = ({ comments, startIndex, userid }) => (
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
          userid={userid}
        />
      ))}
  />
);

CommentList.propTypes = {
  comments: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  startIndex: PropTypes.number,
  userid: PropTypes.string,
};

CommentList.defaultProps = {
  startIndex: 0,
  userid: null,
};

export default CommentList;
