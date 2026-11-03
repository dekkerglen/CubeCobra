import React, { useContext } from 'react';

import Comment from 'components/comments/Comment';
import CommentEntry from 'components/comments/CommentEntry';
import UserContext from 'contexts/UserContext';
import useComments from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';

import Collapse from '../base/Collapse';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import LoadingButton from '../LoadingButton';

export interface CommentsProps {
  parent: string;
  parentType: string;
}

/**
 * A comment thread. Comments arrive from the server ten at a time behind a cursor and are
 * appended, so the list only ever grows — there is no second page to navigate to. It used to
 * carry a client-side pager on top of that cursor, which meant "load more" dropped the new
 * comments onto a page the reader was not looking at.
 */
const CommentsSection: React.FC<CommentsProps> = ({ parent, parentType }) => {
  const user = useContext(UserContext);

  const [replyExpanded, toggleReply] = useToggle(false);
  const [comments, addComment, loading, editComment, hasMore, getMore] = useComments(parent, parentType);

  return (
    <>
      <Flexbox direction="col" gap="2">
        {user && (
          <div className="mx-2 mt-2">
            <Collapse isOpen={!replyExpanded}>
              <Link className="ml-1" onClick={toggleReply}>
                Add a Comment
              </Link>
            </Collapse>
            <CommentEntry submit={addComment} expanded={replyExpanded} toggle={toggleReply} />
          </div>
        )}
        <div>
          {comments.map((comment, index) => (
            <Comment key={`comment-${comment.id}`} comment={comment} index={index} editComment={editComment} />
          ))}
        </div>
      </Flexbox>
      {hasMore && (
        <Flexbox direction="row" justify="center" className="w-full py-2">
          <LoadingButton color="primary" onClick={getMore} loading={loading}>
            Show More
          </LoadingButton>
        </Flexbox>
      )}
    </>
  );
};

export default CommentsSection;
