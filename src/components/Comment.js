import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import CommentPropType from 'proptypes/CommentPropType';
import TimeAgo from 'react-timeago';

import { Collapse } from 'reactstrap';

import UserContext from 'contexts/UserContext';
import LinkButton from 'components/LinkButton';
import CommentContextMenu from 'components/CommentContextMenu';
import useComments from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';
import CommentEntry from 'components/CommentEntry';
import Markdown from 'components/Markdown';
import DomainContext from 'contexts/DomainContext';
import withModal from 'components/WithModal';
import ShareCommentModal from 'components/ShareCommentModal';
import ReportCommentModal from 'components/ReportCommentModal';

const ShareCommentModalButton = withModal('a', ShareCommentModal);
const ReportCommentModalButton = withModal('a', ReportCommentModal);

const maxDepth = 4;

const Comment = ({ comment, index, depth, noReplies, editComment }) => {
  const user = useContext(UserContext);
  const domain = useContext(DomainContext);

  const [replyExpanded, toggleReply] = useToggle(false);
  const [expanded, toggle] = useToggle(false);
  const [comments, addComment, , editChildComment] = useComments(comment.id, 'comment');
  const [loaded, setLoaded] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const remove = () => {
    editComment({
      id: comment.id,
      content: '[deleted]',
      remove: true,
    });
  };

  const edit = (content) => {
    editComment({
      id: comment.id,
      content,
    });
  };

  return (
    <div className={`ps-2 pt-2 flex-container${index % 2 === 0 ? ' comment-bg-even' : ' comment-bg-odd'}`}>
      <a href={`/user/view/${comment.owner}`}>
        <img
          className="profile-thumbnail"
          src={comment.ImageData.uri}
          alt={comment.ImageData.artist}
          title={comment.ImageData.artist}
        />
      </a>
      <div className="flex-grow ms-2">
        <div className="flex-container flex-direction-col">
          <div className="flex-container flex-space-between">
            <div>
              {comment.user.username ? (
                <a href={`/user/view/${comment.owner}`}>
                  <small>{comment.user.username}</small>
                </a>
              ) : (
                <small>Anonymous</small>
              )}
              {comment.date && (
                <small>
                  {' '}
                  - <TimeAgo date={comment.date} />
                </small>
              )}
            </div>
            {user && comment.owner === user.id && (
              <div>
                <CommentContextMenu comment={comment} value="..." edit={() => setIsEdit(true)} remove={remove}>
                  <small>...</small>
                </CommentContextMenu>
              </div>
            )}
          </div>
          <Collapse isOpen={!isEdit}>
            <div className="mb-0">
              <Markdown markdown={comment.body} limited />
            </div>
          </Collapse>
          <CommentEntry
            submit={(res) => {
              edit(res);
              setIsEdit(false);
            }}
            expanded={isEdit}
            defaultValue={comment.body}
            toggle={() => setIsEdit(false)}
          />
          <div>
            {!noReplies && user && (
              <LinkButton onClick={toggleReply}>
                <small>Reply</small>
              </LinkButton>
            )}
            {!noReplies && comments.length > 0 && depth < maxDepth && (
              <LinkButton
                className="ms-2"
                onClick={() => {
                  toggle();
                  setLoaded(true);
                }}
              >
                <small>{`${expanded ? 'Hide' : 'View'} Replies (${comments.length})`}</small>
              </LinkButton>
            )}
            {!noReplies && comments.length > 0 && depth >= maxDepth && (
              <a className="m-2" href={`/comment/${comment.id}`}>
                <small>{`View ${comments.length} ${comments.length > 1 ? 'replies' : 'reply'} in new page...`}</small>
              </a>
            )}
            <ShareCommentModalButton className="ms-2" modalProps={{ comment, domain }}>
              <small>Share</small>
            </ShareCommentModalButton>
            <ReportCommentModalButton className="ms-2" modalProps={{ comment }}>
              <small>Report</small>
            </ReportCommentModalButton>
          </div>
          <CommentEntry
            submit={(res) => {
              addComment(res);
              setLoaded(true);
              if (!expanded) {
                toggle();
              }
            }}
            expanded={replyExpanded}
            toggle={toggleReply}
          />
          {loaded && comments.length > 0 && (
            <Collapse className="border-start" isOpen={expanded}>
              {comments
                .slice(0)
                .reverse()
                .map((item, pos) => (
                  <Comment
                    key={`comment-${comment.id}`}
                    comment={item}
                    index={index + comments.length - pos}
                    depth={depth + 1}
                    editComment={editChildComment}
                  />
                ))}
              {comments.length > 10 && (
                <a className="m-2" href={`/comment/${comment.id}`}>
                  View All...
                </a>
              )}
            </Collapse>
          )}
        </div>
      </div>
    </div>
  );
};

Comment.propTypes = {
  comment: CommentPropType.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number,
  noReplies: PropTypes.bool,
  editComment: PropTypes.func.isRequired,
};

Comment.defaultProps = {
  depth: 0,
  noReplies: false,
};

export default Comment;
