import React from 'react';
import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';
import BlogContextMenu from './BlogContextMenu';
import CommentsSection from './CommentsSection';
import CommentEntry from './CommentEntry';
import AgeText from './AgeText';

class BlogPost extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      childExpanded: props.focused ? true : false,
    };

    this.onPost = this.onPost.bind(this);
    this.submitEdit = this.submitEdit.bind(this);
    this.toggleChildCollapse = this.toggleChildCollapse.bind(this);
  }

  error(message) {
    console.log(message);
  }

  onPost(comment) {
    comment.index = this.props.post.comments.length;
    this.props.post.comments.push(comment);
    this.setState({
      childExpanded: true,
    });
  }

  saveEdit(comments, position, comment) {
    if (position.length == 1) {
      comments[position[0]] = comment;
    } else if (position.length > 1) {
      this.saveEdit(comments[position[0]].comments, position.slice(1), comment);
    }
  }

  toggleChildCollapse() {
    this.setState({
      childExpanded: !this.state.childExpanded,
    });
  }

  async submitEdit(comment, position) {
    //update current state
    this.saveEdit(this.props.post.comments, position, comment);
  }

  componentDidMount() {
    // FIXME: Restore scrolling to highlighted comment.
  }

  render() {
    const { post, onDelete, onEdit } = this.props;
    if (post.html == 'undefined') {
      post.html = null;
    }
    return (
      <Card className="shadowed rounded-0 mt-3">
        <CardHeader className="pl-4 pr-0 pt-2 pb-0">
          <h5 className="card-title">
            {post.title}
            <div className="float-sm-right">
              {this.props.canEdit && (
                <BlogContextMenu
                  className="float-sm-right"
                  post={post}
                  value="..."
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              )}
            </div>
          </h5>
          <h6 className="card-subtitle mb-2 text-muted">
            <a href={'/user/view/' + post.owner}>{post.dev == 'true' ? 'Dekkaru' : post.username}</a>
            {' posted to '}
            {post.dev == 'true' ? (
              <a href={'/dev/blog/0'}>Developer Blog</a>
            ) : (
              <a href={'/cube/overview/' + post.cube}>{post.cubename}</a>
            )}
            {' - '}
            <AgeText date={post.date} />
          </h6>
        </CardHeader>
        <div style={{ overflow: 'auto', maxHeight: '50vh' }}>
          {post.changelist && post.html ? (
            <Row className="no-gutters">
              <Col className="col-12 col-l-5 col-md-4 col-sm-12" style={{ borderRight: '1px solid #DFDFDF' }}>
                <CardBody className="py-2">
                  <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />
                </CardBody>
              </Col>
              <Col className="col-l-7 col-m-6">
                <CardBody className="py-2">
                  <CardText dangerouslySetInnerHTML={{ __html: post.html }} />
                </CardBody>
              </Col>
            </Row>
          ) : (
            <CardBody className="py-2">
              {post.changelist && <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />}
              {post.body && <CardText>{post.body}</CardText>}
              {post.html && <CardText dangerouslySetInnerHTML={{ __html: post.html }} />}
            </CardBody>
          )}
        </div>
        {this.props.loggedIn && (
          <CardBody className="px-4 pt-2 pb-0 border-top">
            <CommentEntry id={post._id} position={[]} onPost={this.onPost} submitUrl={`/cube/api/postcomment`}>
              <h6 className="comment-button mb-2 text-muted clickable">Add Comment</h6>
            </CommentEntry>
          </CardBody>
        )}
        {post.comments && post.comments.length > 0 && (
          <CardBody className=" px-4 pt-2 pb-0 border-top">
            <CommentsSection
              expanded={this.state.childExpanded}
              toggle={this.toggleChildCollapse}
              id={post._id}
              comments={post.comments}
              position={[]}
              userid={this.props.userid}
              loggedIn={this.props.loggedIn}
              submitEdit={this.submitEdit}
              focused={this.props.focused}
              submitUrl={`/cube/api/postcomment`}
            />
          </CardBody>
        )}
      </Card>
    );
  }
}

export default BlogPost;
