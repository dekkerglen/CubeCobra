import React, { useContext } from 'react';

import CommentEntry from 'components/CommentEntry';
import Link from 'components/base/Link';
import CommentList from 'components/PagedCommentList';
import UserContext from 'contexts/UserContext';
import useComments from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';
import Collapse from './base/Collapse';
import LoadingButton from './LoadingButton';

export interface CommentsProps {
  parent: string;
  collapse?: boolean;
  parentType: string;
}

const CommentsSection: React.FC<CommentsProps> = ({ parent, collapse = true, parentType }) => {
  const user = useContext(UserContext);

  const [expanded, toggle] = useToggle(!collapse);
  const [replyExpanded, toggleReply] = useToggle(false);
  const [comments, addComment, loading, editComment, hasMore, getMore] = useComments(parent, parentType);

  return (
    <>
      {collapse && (
        <div className="p-2 border-b">
          <Link className="ml-1" onClick={toggle}>
            {`${expanded ? 'Hide' : 'View'} Comments (${comments.length})`}
          </Link>
        </div>
      )}
      <Collapse isOpen={expanded}>
        <CommentList comments={comments} editComment={editComment}>
          {user && (
            <div className="w-full">
              <Collapse isOpen={!replyExpanded}>
                <Link className="ml-1" onClick={toggleReply}>
                  Add a Comment
                </Link>
              </Collapse>
              <CommentEntry submit={addComment} expanded={replyExpanded} toggle={toggleReply} />
            </div>
          )}
        </CommentList>
      </Collapse>
      {hasMore && (
        <LoadingButton className="m-2" outline block color="accent" onClick={getMore} loading={loading}>
          View More...
        </LoadingButton>
      )}
    </>
  );
};

export default CommentsSection;
