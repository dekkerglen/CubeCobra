import React, { useContext, useState } from 'react';
import { Collapse } from 'reactstrap';

import TimeAgo from 'react-timeago';

import CommentContextMenu from 'components/CommentContextMenu';
import CommentEntry from 'components/CommentEntry';
import LinkButton from 'components/base/LinkButton';
import Markdown from 'components/Markdown';
import ReportCommentModal from 'components/ReportCommentModal';
import ShareCommentModal from 'components/ShareCommentModal';
import withModal from 'components/WithModal';
import DomainContext from 'contexts/DomainContext';
import UserContext from 'contexts/UserContext';
import CommentData from 'datatypes/Comment';
import useComments, { EditRequest } from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';

export interface ShareCommentModalButtonProps {
  modalProps: {
    comment: Comment;
    domain: string;
  };
}

export interface ReportCommentModalButtonProps {
  modalProps: {
    comment: Comment;
  };
}

const ShareCommentModalButton = withModal('a', ShareCommentModal);
const ReportCommentModalButton = withModal('a', ReportCommentModal);

const maxDepth = 4;

export interface CommentProps {
  comment: CommentData;
  index: number;
  depth?: number;
  noReplies?: boolean;
  editComment: (editRequest: EditRequest) => void;
}

const Comment: React.FC<CommentProps> = ({ comment, index, depth = 0, noReplies = false, editComment }) => {
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

  const edit = (content: string) => {
    editComment({
      id: comment.id,
      content,
    });
  };

  return (
    <div className={`ps-2 pt-2 flex-container${index % 2 === 0 ? ' comment-bg-even' : ' comment-bg-odd'}`}>
      {comment.image && (
        <a href={`/user/view/${comment.owner.id}`}>
          <img
            className="profile-thumbnail"
            src={comment.image.uri}
            alt={comment.image.artist}
            title={comment.image.artist}
          />
        </a>
      )}
      <div className="flex-grow ms-2">
        <div className="flex-container flex-direction-col">
          <div className="flex-container flex-space-between">
            <div>
              {comment.owner.username ? (
                <a href={`/user/view/${comment.owner.id}`}>
                  <small>{comment.owner.username}</small>
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
            {user && comment.owner.id === user.id && (
              <div>
                <CommentContextMenu edit={() => setIsEdit(true)} remove={remove}>
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

export default Comment;
