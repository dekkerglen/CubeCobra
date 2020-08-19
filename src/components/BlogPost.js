import React, { useState } from 'react';
import TimeAgo from 'react-timeago';
import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';
import BlogContextMenu from 'components/BlogContextMenu';
import UseCommentsSection from 'components/UseCommentsSection';
import CommentEntry from 'components/CommentEntry';
import Comment from 'components/Comment';
import useToggle from 'hooks/UseToggle';

import PropTypes from 'prop-types';

const CommentsSection = UseCommentsSection(Comment);

const BlogPost = ({ post, onEdit, focused, userid, loggedIn, canEdit }) => {
  const [childExpanded, toggleChildExpanded] = useToggle(!!focused);
  const [comments, setComments] = useState(post.comments);
  const [replyExpanded, toggleReplyExpand] = useToggle(false);

  const onPost = (comment) => {
    comment.index = post.comments.length;
    post.comments.push(comment);
    if (!childExpanded) {
      toggleChildExpanded();
    }
    if (replyExpanded) {
      toggleReplyExpand();
    }
  };

  const updateCommentRecur = (newComments, position, comment) => {
    if (position.length === 1) {
      newComments[position[0]] = comment;
    } else if (position.length > 1) {
      newComments[position[0]] = updateCommentRecur(comments[position[0]].comments, position.slice(1), comment);
    }

    return newComments;
  };

  const insertCommentRecur = (newComments, position, comment) => {
    console.log(position);
    if (position.length === 1) {
      console.log(newComments);
      newComments.push(comment);
    } else if (position.length > 1) {
      newComments[position[0]] = insertCommentRecur(comments[position[0]].comments, position.slice(1), comment);
    }

    return newComments;
  };

  const saveEdit = (position, comment) => {
    setComments(updateCommentRecur(JSON.parse(JSON.stringify(comments)), position, comment));
  };

  const insertReply = (position, comment) => {
    console.log(comments);
    setComments(insertCommentRecur(JSON.parse(JSON.stringify(comments)), position, comment));
  };

  const html = post.html === 'undefined' ? null : post.html;

  return (
    <Card className="shadowed rounded-0 mt-3">
      <CardHeader className="pl-4 pr-0 pt-2 pb-0">
        <h5 className="card-title">
          {post.title}
          <div className="float-sm-right">
            {canEdit && <BlogContextMenu className="float-sm-right" post={post} value="..." onEdit={onEdit} />}
          </div>
        </h5>
        <h6 className="card-subtitle mb-2 text-muted">
          <a href={`/user/view/${post.owner}`}>{post.dev === 'true' ? 'Dekkaru' : post.username}</a>
          {' posted to '}
          {post.dev === 'true' ? (
            <a href="/dev/blog/0">Developer Blog</a>
          ) : (
            <a href={`/cube/overview/${post.cube}`}>{post.cubename}</a>
          )}
          {' - '}
          <TimeAgo date={post.date} />
        </h6>
      </CardHeader>
      <CardBody className="blog-body border-bottom p-1">
        {post.changelist && html ? (
          <Row className="no-gutters">
            <Col className="col-12 col-l-5 col-md-4 col-sm-12" style={{ borderRight: '1px solid #DFDFDF' }}>
              <CardBody className="py-2">
                <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />
              </CardBody>
            </Col>
            <Col className="col-l-7 col-m-6">
              <CardBody className="py-2">
                <CardText dangerouslySetInnerHTML={{ __html: html }} />
              </CardBody>
            </Col>
          </Row>
        ) : (
          <CardBody className="py-2">
            {post.changelist && <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />}
            {post.body && <CardText>{post.body}</CardText>}
            {html && <CardText dangerouslySetInnerHTML={{ __html: html }} />}
          </CardBody>
        )}
      </CardBody>
      {loggedIn && (
        <CardBody className="border-bottom p-2">
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              toggleReplyExpand();
            }}
          >
            {replyExpanded ? 'Cancel' : 'Reply'}
          </a>
          <CommentEntry
            id={post._id}
            position={[]}
            onPost={onPost}
            submitUrl="/cube/api/postcomment"
            expanded={replyExpanded}
            toggle={toggleReplyExpand}
          />
        </CardBody>
      )}
      {comments && comments.length > 0 && (
        <CardBody className="p-2">
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              toggleChildExpanded();
            }}
          >
            {childExpanded ? 'Hide' : 'View'} Replies ({comments.length})
          </a>
          <CommentsSection
            expanded={childExpanded}
            id={post._id}
            comments={comments}
            position={[]}
            userid={userid}
            loggedIn={loggedIn}
            submitEdit={(comment, position) => saveEdit(position, comment)}
            focused={focused}
            submitUrl="/cube/api/postcomment"
            insertReply={insertReply}
          />
        </CardBody>
      )}
    </Card>
  );
};

BlogPost.propTypes = {
  post: PropTypes.shape({
    comments: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    html: PropTypes.string,
    title: PropTypes.string,
    owner: PropTypes.string.isRequired,
    dev: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    cube: PropTypes.string,
    cubename: PropTypes.string.isRequired,
    date: PropTypes.instanceOf(Date).isRequired,
    changelist: PropTypes.string,
    body: PropTypes.string,
    _id: PropTypes.string.isRequired,
  }).isRequired,
  onEdit: PropTypes.func,
  focused: PropTypes.arrayOf(),
  userid: PropTypes.string,
  loggedIn: PropTypes.bool,
  canEdit: PropTypes.bool.isRequired,
};

BlogPost.defaultProps = {
  focused: null,
  userid: null,
  loggedIn: false,
  onEdit: () => {},
};

export default BlogPost;
