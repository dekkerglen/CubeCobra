import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import CommentPropType from 'proptypes/CommentPropType';
import TimeAgo from 'react-timeago';

import {
  Collapse,
  Modal,
  ModalHeader,
  ModalBody,
  InputGroup,
  InputGroupText,
  ModalFooter,
  Button,
  Input,
} from 'reactstrap';

import { ClippyIcon } from '@primer/octicons-react';
import UserContext from 'contexts/UserContext';
import LinkButton from 'components/LinkButton';
import CommentContextMenu from 'components/CommentContextMenu';
import CSRFForm from 'components/CSRFForm';
import useComments from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';
import CommentEntry from 'components/CommentEntry';
import Markdown from 'components/Markdown';
import DomainContext from 'contexts/DomainContext';

const maxDepth = 4;

const Comment = ({ comment, index, depth, noReplies, editComment }) => {
  const user = useContext(UserContext);
  const domain = useContext(DomainContext);

  const [replyExpanded, toggleReply] = useToggle(false);
  const [expanded, toggle] = useToggle(false);
  const [comments, addComment, , editChildComment] = useComments(comment.id, 'comment');
  const [loaded, setLoaded] = useState(false);
  const [shareModalOpen, toggleShareModal] = useToggle(false);
  const [reportModalOpen, toggleReportModal] = useToggle(false);
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
    <>
      <Modal isOpen={shareModalOpen} toggle={toggleShareModal} size="md">
        <ModalHeader toggle={toggle}>Share this Comment</ModalHeader>
        <ModalBody>
          <InputGroup>
            <Input className="bg-white monospaced" value={`https://${domain}/comment/${comment.id}`} readOnly />
            <Button
              className="btn-sm input-group-button"
              onClick={() => navigator.clipboard.writeText(`https://${domain}/comment/${comment.id}`)}
              aria-label="Copy short ID"
            >
              <ClippyIcon size={16} />
            </Button>
          </InputGroup>
        </ModalBody>
      </Modal>
      <Modal isOpen={reportModalOpen} toggle={toggleReportModal} size="lg">
        <CSRFForm method="POST" action="/comment/report" autoComplete="off">
          <ModalHeader toggle={toggle}>Report this Comment</ModalHeader>
          <ModalBody>
            <InputGroup className="mb-3">
              <InputGroupText>Report Reason:</InputGroupText>
              <Input type="select" id="reason" name="reason">
                <option>This is spam or phishing</option>
                <option>This is offensive or abusive</option>
                <option>It expresses intentions of self-harm or suicide</option>
              </Input>
            </InputGroup>
            <Input
              type="textarea"
              className="w-100"
              id="info"
              name="info"
              placeholder="Put any additional comments here."
            />
            <Input type="hidden" name="commentid" value={comment.id} />
          </ModalBody>
          <ModalFooter>
            <Button color="accent">Submit Report</Button>
            <Button color="unsafe" onClick={toggleReportModal}>
              Cancel
            </Button>
          </ModalFooter>
        </CSRFForm>
      </Modal>
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
              <LinkButton className="ms-2" onClick={toggleShareModal}>
                <small>Share</small>
              </LinkButton>
              <LinkButton className="ms-2" onClick={toggleReportModal}>
                <small>Report</small>
              </LinkButton>
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
    </>
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
