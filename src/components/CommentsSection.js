import React from 'react';
import PropTypes from 'prop-types';

import { Collapse, Spinner } from 'reactstrap';

import CommentList from 'components/PagedCommentList';
import LinkButton from 'components/LinkButton';
import CommentEntry from 'components/CommentEntry';
import useToggle from 'hooks/UseToggle';
import useComments from 'hooks/UseComments';

const CommentsSection = ({ parent, parentType, collapse, userid }) => {
  const [expanded, toggle] = useToggle(!collapse);
  const [replyExpanded, toggleReply] = useToggle(false);
  const [comments, addComment, loading] = useComments(parentType, parent);

  const replyEntry = userid && (
    <div className="p-2 border-bottom">
      <Collapse isOpen={!replyExpanded}>
        <h6>
          <LinkButton className="ml-1" onClick={toggleReply}>
            Add a Comment
          </LinkButton>
        </h6>
      </Collapse>
      <CommentEntry submit={addComment} expanded={replyExpanded} toggle={toggleReply} />
    </div>
  );

  if (loading) {
    return (
      <div className="centered py-3">
        <Spinner className="position-absolute" />
      </div>
    );
  }

  if (comments.length === 0) {
    return replyEntry;
  }

  if (collapse) {
    return (
      <>
        {replyEntry}
        <Collapse isOpen={expanded}>
          <h6 className="comment-button mb-2 text-muted clickable" onClick={toggle}>
            {expanded ? 'Hide' : 'View'} Replies ({comments.length})
          </h6>
        </Collapse>
        <CommentList comments={comments} userid={userid} />
      </>
    );
  }

  return (
    <>
      {replyEntry}
      <CommentList comments={comments} userid={userid} />
    </>
  );
};

CommentsSection.propTypes = {
  parent: PropTypes.string.isRequired,
  parentType: PropTypes.string.isRequired,
  collapse: PropTypes.bool,
  userid: PropTypes.string,
};

CommentsSection.defaultProps = {
  collapse: false,
  userid: null,
};

export default CommentsSection;
