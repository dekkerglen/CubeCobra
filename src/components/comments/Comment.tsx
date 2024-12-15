import React, { useContext, useState } from 'react';

import TimeAgo from 'react-timeago';

import CommentEntry from 'components/comments/CommentEntry';
import Link from 'components/base/Link';
import Markdown from 'components/Markdown';
import ReportCommentModal from 'components/modals/ReportCommentModal';
import ShareCommentModal from 'components/modals/ShareCommentModal';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import CommentData from 'datatypes/Comment';
import useComments, { EditRequest } from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';
import Collapse from '../base/Collapse';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import classNames from 'classnames';

export interface ShareCommentModalButtonProps {
  modalprops: {
    comment: Comment;
  };
}

export interface ReportCommentModalButtonProps {
  modalprops: {
    comment: Comment;
  };
}

const ShareCommentModalButton = withModal(Link, ShareCommentModal);
const ReportCommentModalButton = withModal(Link, ReportCommentModal);

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

  if (!comment.owner) {
    comment.owner = {
      id: '',
      username: '',
    };
  }

  return (
    <Flexbox
      direction="row"
      className={classNames(`border border-border ps-2 pt-2`, {
        'bg-bg': index % 2 === 0,
        'bg-bg-accent': index % 2 === 1,
      })}
    >
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
        <Flexbox direction="col">
          <Flexbox justify="between" direction="row" className="mr-2">
            <Text sm>
              {comment.owner.username ? (
                <Link href={`/user/view/${comment.owner.id}`}>{comment.owner.username}</Link>
              ) : (
                'Anonymous'
              )}
              {comment.date && (
                <>
                  {' - '}
                  <TimeAgo date={comment.date} />
                </>
              )}
            </Text>
          </Flexbox>
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
          <Flexbox direction="row" gap="2">
            {!noReplies && user && (
              <Link onClick={toggleReply}>
                <Text sm>Reply</Text>
              </Link>
            )}
            {user && comment.owner.id === user.id && (
              <>
                <Link onClick={() => setIsEdit(true)}>
                  <Text sm>Edit</Text>
                </Link>
                <Link onClick={() => remove()}>
                  <Text sm>Delete</Text>
                </Link>
              </>
            )}
            {!noReplies && comments.length > 0 && depth < maxDepth && (
              <Link
                onClick={() => {
                  toggle();
                  setLoaded(true);
                }}
              >
                <Text sm>{`${expanded ? 'Hide' : 'View'} Replies (${comments.length})`}</Text>
              </Link>
            )}
            {!noReplies && comments.length > 0 && depth >= maxDepth && (
              <Link className="m-2" href={`/comment/${comment.id}`}>
                <Text sm>{`View ${comments.length} ${comments.length > 1 ? 'replies' : 'reply'} in new page...`}</Text>
              </Link>
            )}
            <ShareCommentModalButton modalprops={{ comment }}>
              <Text sm>Share</Text>
            </ShareCommentModalButton>
            <ReportCommentModalButton modalprops={{ comment }}>
              <Text sm>Report</Text>
            </ReportCommentModalButton>
          </Flexbox>
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
        </Flexbox>
      </div>
    </Flexbox>
  );
};

export default Comment;
