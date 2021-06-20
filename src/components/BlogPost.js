import React, { useContext } from 'react';

import PropTypes from 'prop-types';
import BlogPostPropType from 'proptypes/BlogPostPropType';

import TimeAgo from 'react-timeago';

import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';

import UserContext from 'contexts/UserContext';
import BlogContextMenu from 'components/BlogContextMenu';
import CommentsSection from 'components/CommentsSection';
import Markdown from 'components/Markdown';

const BlogPost = ({ post, onEdit, noScroll }) => {
  const user = useContext(UserContext);

  const html = post.html === 'undefined' ? null : post.html;

  const scrollStyle = noScroll ? {} : { overflow: 'auto', maxHeight: '50vh' };

  const canEdit = user && user.id === post.owner;

  return (
    <Card className="shadowed rounded-0 mb-3">
      <CardHeader className="pl-4 pr-0 pt-2 pb-0">
        <h5 className="card-title">
          <a href={`/cube/blog/blogpost/${post._id}`}>{post.title}</a>
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
      <div style={scrollStyle}>
        {post.changelist && (html || post.markdown) ? (
          <Row className="no-gutters">
            <Col className="col-12 col-l-5 col-md-4 col-sm-12 blog-post-border">
              <CardBody className="py-2">
                <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />
              </CardBody>
            </Col>
            <Col className="col-l-7 col-m-6">
              <CardBody className="py-2">
                {post.markdown ? (
                  <Markdown markdown={post.markdown} limited />
                ) : (
                  <CardText dangerouslySetInnerHTML={{ __html: html }} />
                )}
              </CardBody>
            </Col>
          </Row>
        ) : (
          <CardBody className="py-2">
            {post.changelist && <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />}
            {post.body && <CardText>{post.body}</CardText>}
            {(html || post.markdown) &&
              (post.markdown ? (
                <Markdown markdown={post.markdown} limited />
              ) : (
                <CardText dangerouslySetInnerHTML={{ __html: html }} />
              ))}
          </CardBody>
        )}
      </div>
      <div className="border-top">
        <CommentsSection parentType="blog" parent={post._id} collapse={false} />
      </div>
    </Card>
  );
};

BlogPost.propTypes = {
  post: BlogPostPropType.isRequired,
  onEdit: PropTypes.func.isRequired,
  noScroll: PropTypes.bool,
};

BlogPost.defaultProps = {
  noScroll: false,
};

export default BlogPost;
