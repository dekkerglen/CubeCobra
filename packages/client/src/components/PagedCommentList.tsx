import React from 'react';

import CommentType from '@utils/datatypes/Comment';

import Comment from 'components/comments/Comment';
import PagedList from 'components/PagedList';
import { EditRequest } from 'hooks/UseComments';

interface CommentListProps {
  comments: CommentType[];
  editComment: (editRequest: EditRequest) => void;
  children?: React.ReactNode;
}

const CommentList: React.FC<CommentListProps> = ({ comments, editComment, children }) => (
  <PagedList
    pageSize={10}
    showBottom
    rows={comments.map((comment, index) => (
      <Comment key={`comment-${comment.id}`} comment={comment} index={index} editComment={editComment} />
    ))}
  >
    {children}
  </PagedList>
);

export default CommentList;
