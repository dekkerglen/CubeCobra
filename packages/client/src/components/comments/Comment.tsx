import React, { useContext, useState } from 'react';

import CommentData from '@utils/datatypes/Comment';
import classNames from 'classnames';

import Datetime from 'components/base/Datetime';
import Link from 'components/base/Link';
import CommentEntry from 'components/comments/CommentEntry';
import Markdown from 'components/Markdown';
import ReportCommentModal from 'components/modals/ReportCommentModal';
import ShareCommentModal from 'components/modals/ShareCommentModal';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import useComments, { EditRequest } from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';

import Collapse from '../base/Collapse';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

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

// Ambush Viper art, used as a fallback when a user's profile image fails to load.
const FALLBACK_IMAGE_URI =
  'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/0/e/0e386888-57f5-4eb6-88e8-5679bb8eb290.jpg?1608910517';

export interface CommentProps {
  comment: CommentData;
  index: number;
  depth?: number;
  noReplies?: boolean;
  isLast?: boolean;
  editComment: (editRequest: EditRequest) => void;
}

const Comment: React.FC<CommentProps> = ({
  comment,
  index,
  depth = 0,
  noReplies = false,
  isLast = false,
  editComment,
}) => {
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
    <div
      className={classNames('pt-3', {
        'px-2 pb-3 border-b border-border': depth === 0,
        // Threaded connector: a vertical line down the left that curves in to point at the avatar.
        "relative pl-9 before:content-[''] before:absolute before:left-[22px] before:top-0 before:h-9 before:w-[14px] before:rounded-bl-[10px] before:border-l-2 before:border-b-2 before:border-border":
          depth > 0,
        // Continue the vertical line down to the next sibling (omitted on the last reply so it stops here).
        "after:content-[''] after:absolute after:left-[22px] after:top-0 after:bottom-0 after:border-l-2 after:border-border":
          depth > 0 && !isLast,
      })}
    >
      <Flexbox direction="row" gap="2" className="relative">
        {comment.image && (
          <a href={`/user/view/${comment.owner.id}`} className="flex-shrink-0">
            <img
              className="w-11 h-11 rounded-full object-cover border border-border mt-0.5"
              src={comment.image.uri}
              alt={comment.image.artist}
              title={comment.image.artist}
              onError={(e) => {
                if (e.currentTarget.src !== FALLBACK_IMAGE_URI) {
                  e.currentTarget.src = FALLBACK_IMAGE_URI;
                }
              }}
            />
          </a>
        )}
        {loaded && expanded && comments.length > 0 && (
          <div className="absolute left-[22px] top-[46px] bottom-0 border-l-2 border-border" aria-hidden />
        )}
        <div className="flex-grow min-w-0">
          <Flexbox direction="col" gap="1">
            <Text sm>
              {comment.owner.username ? (
                <Link href={`/user/view/${comment.owner.id}`}>{comment.owner.username}</Link>
              ) : (
                'Anonymous'
              )}
              {comment.date && (
                <span className="text-text-secondary">
                  {' · '}
                  <Datetime date={comment.date} />
                </span>
              )}
            </Text>
            <Collapse isOpen={!isEdit}>
              <div className="overflow-x-auto max-w-full">
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
                  <Text
                    sm
                  >{`View ${comments.length} ${comments.length > 1 ? 'replies' : 'reply'} in new page...`}</Text>
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
          </Flexbox>
        </div>
      </Flexbox>
      {loaded && comments.length > 0 && (
        <Collapse className="" isOpen={expanded}>
          {comments
            .slice(0)
            .reverse()
            .map((item, pos) => (
              <Comment
                key={`comment-${comment.id}`}
                comment={item}
                index={index + comments.length - pos}
                depth={depth + 1}
                isLast={pos === comments.length - 1}
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
  );
};

export default Comment;
