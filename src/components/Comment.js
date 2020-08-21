import React, { useState } from 'react';
import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

import {
  Collapse,
  Modal,
  ModalHeader,
  ModalBody,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  CustomInput,
  ModalFooter,
  Button,
  Input,
} from 'reactstrap';

import LinkButton from 'components/LinkButton';
import CommentContextMenu from 'components/CommentContextMenu';
import CSRFForm from 'components/CSRFForm';
import useComments from 'hooks/UseComments';
import useToggle from 'hooks/UseToggle';
import CommentEntry from 'components/CommentEntry';

const maxDepth = 4;

const Comment = ({ comment, index, depth, userid, noReplies }) => {
  const [replyExpanded, toggleReply] = useToggle(false);
  const [expanded, toggle] = useToggle(false);
  const [comments, addComment] = useComments('comment', comment._id);
  const [loaded, setLoaded] = useState(false);
  const [shareModalOpen, toggleShareModal] = useToggle(false);
  const [reportModalOpen, toggleReportModal] = useToggle(false);

  return (
    <>
      <Modal isOpen={shareModalOpen} toggle={toggleShareModal} size="md">
        <ModalHeader toggle={toggle}>Share this Comment</ModalHeader>
        <ModalBody>
          <a href={`/comment/${comment._id}`}>Link to Comment</a>
        </ModalBody>
      </Modal>
      <Modal isOpen={reportModalOpen} toggle={toggleReportModal} size="lg">
        <CSRFForm method="POST" action="/comment/report" autoComplete="off">
          <ModalHeader toggle={toggle}>Report this Comment</ModalHeader>
          <ModalBody>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Report Reason:</InputGroupText>
              </InputGroupAddon>
              <CustomInput type="select" id="reason" name="reason">
                <option>This is spam or phishing</option>
                <option>This is offensive or abusive</option>
                <option>It expresses intentions of self-harm or suicide</option>
              </CustomInput>
            </InputGroup>
            <Input
              type="textarea"
              className="w-100"
              id="info"
              name="info"
              placeholder="Put any additional comments here."
            />
            <Input type="hidden" name="commentid" value={comment._id} />
          </ModalBody>
          <ModalFooter>
            <Button color="success">Submit Report</Button>
            <Button color="danger" onClick={toggleReportModal}>
              Cancel
            </Button>
          </ModalFooter>
        </CSRFForm>
      </Modal>
      <div className={`pl-2 pt-2 flex-container${index % 2 === 0 ? ' comment-bg-even' : ' comment-bg-odd'}`}>
        <a href={`/user/view/${comment.owner}`}>
          <img className="profile-thumbnail" src={comment.image} alt={comment.artist} title={comment.artist} />
        </a>
        <div className="flex-grow ml-2">
          <div className="flex-container flex-direction-col">
            <div className="flex-container flex-space-between">
              <div>
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
              </div>
              {comment.owner === userid && (
                <div>
                  <CommentContextMenu comment={comment} value="..." edit={() => {}} remove={() => {}}>
                    <small>...</small>
                  </CommentContextMenu>
                </div>
              )}
            </div>
            <p className="mb-0">{comment.content}</p>

            <div>
              {!noReplies && userid && (
                <LinkButton onClick={toggleReply}>
                  <small>Reply</small>
                </LinkButton>
              )}
              {!noReplies && comments.length > 0 && depth < maxDepth && (
                <LinkButton
                  className="ml-2"
                  onClick={() => {
                    toggle();
                    setLoaded(true);
                  }}
                >
                  <small>{`${expanded ? 'Hide' : 'View'} Replies (${comments.length})`}</small>
                </LinkButton>
              )}
              {!noReplies && comments.length > 0 && depth >= maxDepth && (
                <a className="m-2" href={`/comment/${comment._id}`}>
                  <small>{`View ${comments.length} ${comments.length > 1 ? 'replies' : 'reply'} in new page...`}</small>
                </a>
              )}
              <LinkButton className="ml-2" onClick={toggleShareModal}>
                <small>Share</small>
              </LinkButton>
              <LinkButton className="ml-2" onClick={toggleReportModal}>
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
              <Collapse className="border-left" isOpen={expanded}>
                {comments
                  .slice(0)
                  .reverse()
                  .map((item, pos) => (
                    <Comment
                      key={`comment-${comment._id}`}
                      comment={item}
                      index={index + comments.length - pos}
                      depth={depth + 1}
                      userid={userid}
                    />
                  ))}
                {comments.length > 10 && (
                  <a className="m-2" href={`/comment/${comment._id}`}>
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
  comment: PropTypes.shape({
    timePosted: PropTypes.instanceOf(Date).isRequired,
    ownerName: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    updated: PropTypes.bool.isRequired,
    _id: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number,
  userid: PropTypes.string,
  noReplies: PropTypes.bool,
};

Comment.defaultProps = {
  depth: 0,
  userid: null,
  noReplies: false,
};

export default Comment;
