import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import { Collapse, Button, Spinner } from 'reactstrap';

import UserContext from 'contexts/UserContext';
import CommentList from 'components/PagedCommentList';
import LinkButton from 'components/LinkButton';
import CommentEntry from 'components/CommentEntry';
import useToggle from 'hooks/UseToggle';
import useComments from 'hooks/UseComments';

const CommentsSection = ({ parent, collapse, parentType }) => {
  const user = useContext(UserContext);

  const [expanded, toggle] = useToggle(!collapse);
  const [replyExpanded, toggleReply] = useToggle(false);
  const [comments, addComment, loading, editComment, hasMore, getMore] = useComments(parent, parentType);

  return (
    <>
      {user && (
        <div className="p-2 border-bottom">
          <Collapse isOpen={!replyExpanded}>
            <h6>
              <LinkButton className="ms-1" onClick={toggleReply}>
                Add a Comment
              </LinkButton>
            </h6>
          </Collapse>
          <CommentEntry submit={addComment} expanded={replyExpanded} toggle={toggleReply} />
        </div>
      )}
      {comments.length > 0 && (
        <>
          {collapse && (
            <div className="p-2 border-bottom">
              <h6>
                <LinkButton className="ms-1" onClick={toggle}>
                  {`${expanded ? 'Hide' : 'View'} Comments (${comments.length})`}
                </LinkButton>
              </h6>
            </div>
          )}
          <Collapse isOpen={expanded}>
            <CommentList comments={comments} editComment={editComment} />
          </Collapse>
          {loading && hasMore && (
            <div className="centered m-1">
              <Spinner />
            </div>
          )}
          {hasMore && (
            <div className="p-1">
              <Button outline block color="primary" onClick={getMore} disabled={loading}>
                View More...
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
};

CommentsSection.propTypes = {
  parent: PropTypes.string.isRequired,
  collapse: PropTypes.bool,
  parentType: PropTypes.string.isRequired,
};

CommentsSection.defaultProps = {
  collapse: true,
};

export default CommentsSection;
