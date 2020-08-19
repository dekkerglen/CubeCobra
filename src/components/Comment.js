import React, { useState } from 'react';
import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

import { Collapse } from 'reactstrap';

import CommentEntry from 'components/CommentEntry';
import useToggle from 'hooks/UseToggle';
import UseCommentsSection from 'components/UseCommentsSection';
import CommentContextMenu from 'components/CommentContextMenu';
import csrfFetch from 'utils/CSRF';

const InnerComment = ({
  comment,
  focused,
  userid,
  position,
  id,
  loggedIn,
  submitEdit,
  submitUrl,
  insertReply,
  toggleExpand,
  hasReplies,
  expandRepliesText,
  expanded,
}) => {
  const [isEdit, setIsEdit] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const [replyExpanded, toggleReplyExpand] = useToggle(false);

  const highlighted = focused ? focused.length === 0 : false;

  const updateServerSide = async () => {
    // send edit command to server
    await csrfFetch(`/cube/api/editcomment`, {
      method: 'POST',
      body: JSON.stringify({
        id,
        comment,
        position,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch((err) => console.error(err));
  };

  const submitDelete = () => {
    const newComment = JSON.parse(JSON.stringify(comment));

    newComment.content = '[comment deleted]';
    newComment.updated = true;
    // this -1000 (ms) is to prevent a strange date display bug
    newComment.timePosted = new Date() - 1000;
    newComment.owner = null;
    newComment.ownerName = null;

    submitEdit(newComment, position);
    updateServerSide();
  };

  const finishEdit = () => {
    if (editValue.length > 0) {
      const newComment = JSON.parse(JSON.stringify(comment));

      newComment.content = editValue;
      newComment.updated = true;
      // this -1000 (ms) is to prevent a strange date display bug
      newComment.timePosted = new Date() - 1000;

      submitEdit(newComment, position);
      setIsEdit(false);
      updateServerSide();
    }
  };

  const onPost = (newComment) => {
    insertReply(position, newComment);
    if (!expanded) {
      toggleExpand();
    }
  };

  const artist = comment.artist ?? 'Allan Pollack';
  const image =
    comment.image ??
    'https://img.scryfall.com/cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021';

  return (
    <>
      <div className="comment-container">
        <a href={`/user/view/${comment.owner}`}>
          <img
            className="profile-thumbnail mt-2 mr-2"
            src={image}
            title={`Art by ${artist}`}
            alt={`Art by ${artist}`}
          />
        </a>
        <div className="comment-body">
          {comment.ownerName ? (
            <a href={`/user/view/${comment.owner}`}>
              <small>{comment.ownerName}</small>
            </a>
          ) : (
            <small>Anonymous</small>
          )}
          {comment.timePosted &&
            (comment.updated ? (
              <em>
                <small>
                  {' '}
                  - Updated <TimeAgo date={comment.timePosted} />
                </small>
              </em>
            ) : (
              <small>
                {' '}
                - <TimeAgo date={comment.timePosted} />
              </small>
            ))}
          {comment.owner === userid && (
            <div className="float-sm-right">
              <CommentContextMenu
                className="float-sm-right"
                comment={comment}
                value="..."
                edit={() => setIsEdit(true)}
                delete={submitDelete}
              />
            </div>
          )}
          <Collapse isOpen={!isEdit}>{comment.content}</Collapse>
          <Collapse isOpen={isEdit}>
            <textarea
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              className="form-control"
              id="exampleFormControlTextarea1"
              rows="2"
              maxLength="500"
            />
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                finishEdit();
              }}
            >
              Submit
            </a>{' '}
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setIsEdit(false);
              }}
            >
              Cancel
            </a>
          </Collapse>
          <div>
            {position.length < 20 && loggedIn && (
              /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
              <a
                href="#"
                className="mr-2"
                onClick={(event) => {
                  event.preventDefault();
                  toggleReplyExpand();
                }}
              >
                {replyExpanded ? 'Cancel' : 'Reply'}
              </a>
            )}
            {hasReplies && (
              /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  toggleExpand();
                }}
              >
                {expandRepliesText}
              </a>
            )}
          </div>
        </div>
      </div>
      {position.length < 20 && loggedIn && (
        <div className="p-1">
          <CommentEntry
            id={id}
            position={position}
            onPost={onPost}
            submitUrl={submitUrl}
            expanded={replyExpanded}
            toggle={toggleReplyExpand}
          >
            Reply
          </CommentEntry>
        </div>
      )}
    </>
  );
};

InnerComment.propTypes = {
  comment: PropTypes.shape({
    owner: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    ownerName: PropTypes.string.isRequired,
    timePosted: PropTypes.instanceOf(Date).isRequired,
    updated: PropTypes.bool,
    content: PropTypes.string.isRequired,
    comments: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
  focused: PropTypes.arrayOf(PropTypes.number),
  userid: PropTypes.string,
  loggedIn: PropTypes.bool.isRequired,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  id: PropTypes.string.isRequired,
  submitEdit: PropTypes.func.isRequired,
  submitUrl: PropTypes.string.isRequired,
  insertReply: PropTypes.func.isRequired,
};

InnerComment.defaultProps = {
  focused: null,
  userid: null,
};

const CommentsSection = UseCommentsSection(InnerComment);

const Comment = ({ comment, focused, userid, position, id, loggedIn, submitEdit, submitUrl, insertReply }) => {
  const [expanded, toggleExpanded] = useToggle(false);

  return (
    <div className="my-2 pl-2">
      <InnerComment
        comment={comment}
        focused={focused}
        userid={userid}
        loggedIn={loggedIn}
        position={position}
        id={id}
        submitEdit={submitEdit}
        submitUrl={submitUrl}
        insertReply={insertReply}
        toggleExpand={toggleExpanded}
        expanded={expanded}
        hasReplies={comment.comments.length > 0}
        expandRepliesText={`${expanded ? 'Hide' : 'View'} Replies (${comment.comments.length})`}
      />
      {comment.comments.length > 0 && (
        <div className="pl-2 pt-1 pr-1 border-left">
          <CommentsSection
            className="pl-4"
            expanded={expanded}
            toggle={() => toggleExpanded()}
            id={id}
            comments={comment.comments}
            position={position}
            userid={userid}
            loggedIn={loggedIn}
            submitEdit={submitEdit}
            focused={focused && focused.length > 0 ? focused : false}
            submitUrl={submitUrl}
            insertReply={insertReply}
          />
        </div>
      )}
    </div>
  );
};

Comment.propTypes = {
  comment: PropTypes.shape({
    owner: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    ownerName: PropTypes.string.isRequired,
    timePosted: PropTypes.instanceOf(Date).isRequired,
    updated: PropTypes.bool,
    content: PropTypes.string.isRequired,
    comments: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
  focused: PropTypes.arrayOf(PropTypes.number),
  userid: PropTypes.string,
  loggedIn: PropTypes.bool.isRequired,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  id: PropTypes.string.isRequired,
  submitEdit: PropTypes.func.isRequired,
  submitUrl: PropTypes.string.isRequired,
  insertReply: PropTypes.func.isRequired,
};

Comment.defaultProps = {
  focused: null,
  userid: null,
};

export default Comment;
